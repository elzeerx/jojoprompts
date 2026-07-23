
-- ============================================================
-- Phase 6A.2 — Collection entitlement contract (main)
-- ============================================================

-- 1) collection_key column ------------------------------------
ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS collection_key text;

-- 2) Refresh shape/reason constraints -------------------------
ALTER TABLE public.entitlements
  DROP CONSTRAINT IF EXISTS entitlements_scope_resource_shape,
  DROP CONSTRAINT IF EXISTS entitlements_reason_scope_valid,
  DROP CONSTRAINT IF EXISTS entitlements_collection_key_valid,
  DROP CONSTRAINT IF EXISTS entitlements_collection_shape;

ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_scope_resource_shape CHECK (
    (scope = 'resource'   AND resource_id IS NOT NULL AND collection_key IS NULL) OR
    (scope = 'library'    AND resource_id IS NULL     AND collection_key IS NULL) OR
    (scope = 'collection' AND resource_id IS NULL     AND collection_key IS NOT NULL)
  );

ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_collection_key_valid CHECK (
    collection_key IS NULL
    OR collection_key IN ('chatgpt_prompts','midjourney_prompts')
  );

ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_reason_scope_valid CHECK (
    CASE grant_reason
      WHEN 'purchase'            THEN scope = 'resource'
      WHEN 'free_acquisition'    THEN scope = 'resource'
      WHEN 'lifetime_purchase'   THEN scope = 'library'
      WHEN 'lifetime_threshold'  THEN scope = 'library'
      WHEN 'legacy_migration'    THEN scope IN ('resource','library','collection')
      WHEN 'admin_grant'         THEN scope IN ('resource','library','collection')
    END
  );

-- 3) Trigger update: collection must have version_major NULL
CREATE OR REPLACE FUNCTION public.v2_validate_entitlement_version_major()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.scope = 'library'::public.v2_entitlement_scope THEN
    IF NEW.version_major IS NOT NULL THEN
      RAISE EXCEPTION 'library-scope entitlements must have version_major NULL' USING ERRCODE='check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.scope = 'collection'::public.v2_entitlement_scope THEN
    IF NEW.version_major IS NOT NULL THEN
      RAISE EXCEPTION 'collection-scope entitlements must have version_major NULL' USING ERRCODE='check_violation';
    END IF;
    IF NEW.grant_reason NOT IN ('legacy_migration'::public.v2_grant_reason,'admin_grant'::public.v2_grant_reason) THEN
      RAISE EXCEPTION 'collection-scope allowed only for legacy_migration or admin_grant' USING ERRCODE='check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.grant_reason IN ('lifetime_purchase'::public.v2_grant_reason,'lifetime_threshold'::public.v2_grant_reason) THEN
    RAISE EXCEPTION 'lifetime grant_reason requires scope=library' USING ERRCODE='check_violation';
  END IF;
  IF NEW.grant_reason IN ('purchase'::public.v2_grant_reason,'free_acquisition'::public.v2_grant_reason)
     AND NEW.version_major IS NULL THEN
    RAISE EXCEPTION 'resource-scope purchase/free_acquisition requires version_major' USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Uniqueness index for active collection entitlements ------
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_one_active_collection_per_user
  ON public.entitlements (user_id, collection_key)
  WHERE scope = 'collection'::public.v2_entitlement_scope
    AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS entitlements_active_collection_idx
  ON public.entitlements (user_id, collection_key)
  WHERE revoked_at IS NULL AND scope = 'collection'::public.v2_entitlement_scope;

-- 5) Central matcher -----------------------------------------
CREATE OR REPLACE FUNCTION public.v2_resource_collection_key(p_resource_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_type text;
  v_legacy_type text;
  v_has_chatgpt boolean;
  v_has_midjourney boolean;
  v_has_conflict boolean;
  v_chatgpt boolean := false;
  v_midjourney boolean := false;
BEGIN
  IF p_resource_id IS NULL THEN RETURN NULL; END IF;

  SELECT r.type::text INTO v_type FROM public.resources r WHERE r.id = p_resource_id;
  IF v_type IS NULL THEN RETURN NULL; END IF;

  SELECT p.prompt_type INTO v_legacy_type
    FROM public.resources r
    LEFT JOIN public.prompts p ON p.id = r.legacy_prompt_id
   WHERE r.id = p_resource_id;

  SELECT
    bool_or(lower(pc.platform_slug) IN ('chatgpt','gpts-builder','openai')),
    bool_or(lower(pc.platform_slug) = 'midjourney'),
    bool_or(lower(pc.platform_slug) IN ('gemini','claude','kimi','anthropic'))
  INTO v_has_chatgpt, v_has_midjourney, v_has_conflict
  FROM public.platform_compatibility pc
  WHERE pc.resource_id = p_resource_id;

  v_has_chatgpt    := COALESCE(v_has_chatgpt,false);
  v_has_midjourney := COALESCE(v_has_midjourney,false);
  v_has_conflict   := COALESCE(v_has_conflict,false);

  IF v_has_chatgpt AND v_type = 'prompt' THEN v_chatgpt := true; END IF;
  IF NOT v_chatgpt
     AND v_legacy_type IN ('text','chatgpt-gpt-builder')
     AND NOT v_has_conflict
     AND NOT v_has_midjourney THEN
    v_chatgpt := true;
  END IF;

  IF v_has_midjourney AND v_type IN ('prompt','image_style') THEN v_midjourney := true; END IF;
  IF NOT v_midjourney AND v_legacy_type = 'midjourney-sref' THEN v_midjourney := true; END IF;

  IF v_chatgpt AND v_midjourney THEN RETURN NULL; END IF;
  IF v_chatgpt THEN RETURN 'chatgpt_prompts'; END IF;
  IF v_midjourney THEN RETURN 'midjourney_prompts'; END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_resource_collection_key(uuid) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.v2_resource_collection_key(uuid) IS
  'Server-authoritative resource->collection matcher. UI must never re-implement.';

-- 6) get_my_library_state ------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_library_state()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_progress int;
  v_ents jsonb;
  v_has_lib boolean;
  v_collections text[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE='28000'; END IF;

  SELECT LEAST(GREATEST(COALESCE(SUM(amount_fils),0),0),30000)::int INTO v_progress
    FROM public.lifetime_credit_entries WHERE user_id = v_user;

  SELECT EXISTS (
    SELECT 1 FROM public.entitlements e
     WHERE e.user_id = v_user
       AND e.scope = 'library'::public.v2_entitlement_scope
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > now())
  ) INTO v_has_lib;

  SELECT COALESCE(array_agg(DISTINCT collection_key),'{}') INTO v_collections
    FROM public.entitlements
   WHERE user_id = v_user
     AND scope = 'collection'::public.v2_entitlement_scope
     AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now());

  SELECT COALESCE(jsonb_agg(row_to_json(x)),'[]'::jsonb) INTO v_ents
  FROM (
    SELECT e.id, e.resource_id, e.scope, e.collection_key,
           e.grant_reason, e.version_major, e.granted_at, e.expires_at
      FROM public.entitlements e
     WHERE e.user_id = v_user
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > now())
     ORDER BY e.granted_at DESC
  ) x;

  RETURN jsonb_build_object(
    'entitlements', v_ents,
    'has_library_access', v_has_lib,
    'active_collection_keys', to_jsonb(v_collections),
    'lifetime_progress_fils', v_progress,
    'lifetime_threshold_fils', 30000,
    'lifetime_remaining_fils', GREATEST(30000 - v_progress, 0)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_library_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_library_state() TO authenticated;

-- 7) authorize_resource_download -----------------------------
CREATE OR REPLACE FUNCTION public.authorize_resource_download(p_file_id uuid)
RETURNS TABLE (storage_bucket text, storage_path text, file_name text, content_type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_res uuid; v_major int; v_ver uuid; v_ck text;
  v_scan public.v2_scan_status;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE='28000'; END IF;

  SELECT rv.resource_id, rv.major_version, rv.id
    INTO v_res, v_major, v_ver
  FROM public.resource_files rf
  JOIN public.resource_versions rv ON rv.id = rf.resource_version_id
  WHERE rf.id = p_file_id;

  IF v_res IS NULL THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;

  v_ck := public.v2_resource_collection_key(v_res);

  IF NOT EXISTS (
    SELECT 1 FROM public.entitlements e
    WHERE e.user_id = v_user
      AND e.revoked_at IS NULL
      AND (e.expires_at IS NULL OR e.expires_at > now())
      AND (
        e.scope = 'library'::public.v2_entitlement_scope
        OR (e.scope = 'resource'::public.v2_entitlement_scope
            AND e.resource_id = v_res
            AND (e.version_major IS NULL OR e.version_major = v_major))
        OR (e.scope = 'collection'::public.v2_entitlement_scope
            AND v_ck IS NOT NULL
            AND e.collection_key = v_ck)
      )
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;

  SELECT s.status INTO v_scan
  FROM public.package_scans s
  WHERE s.resource_version_id = v_ver
  ORDER BY s.scanned_at DESC NULLS LAST, s.created_at DESC LIMIT 1;

  IF v_scan IS NULL OR v_scan <> 'clean' THEN
    RAISE EXCEPTION 'package unavailable' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
    SELECT rf.storage_bucket, rf.storage_path, rf.file_name, rf.content_type
    FROM public.resource_files rf WHERE rf.id = p_file_id;
END;
$$;
REVOKE ALL ON FUNCTION public.authorize_resource_download(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authorize_resource_download(uuid) TO authenticated;

-- 8) v2_create_checkout_order — already-owned now honors collection scope
CREATE OR REPLACE FUNCTION public.v2_create_checkout_order(
  p_actor_user_id uuid,
  p_product_ids uuid[],
  p_idempotency_key text,
  p_discount_code text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_dedup uuid[]; v_product record; v_products_count int;
  v_has_lifetime boolean := false; v_has_non_lifetime boolean := false;
  v_subtotal int := 0; v_lifetime_price int := 30000;
  v_credit int := 0; v_lifetime_credit_applied int := 0;
  v_active_lifetime boolean := false;
  v_already_owned uuid[] := '{}'; v_already_owned_products uuid[] := '{}';
  v_overlap uuid[] := '{}'; v_order_id uuid; v_order_number text; v_merchant_ref text;
  v_attempt_id uuid; v_discount record; v_discount_fils int := 0;
  v_total int := 0; v_provider text; v_existing_order record;
  v_used_by int; v_used_by_user int; v_pending_conflict record;
  v_uncovered_product_ids uuid[];
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_actor_user_id) THEN
    RAISE EXCEPTION 'actor_not_found' USING ERRCODE='P0002';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key)='' OR char_length(p_idempotency_key) > 120 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE='22023';
  END IF;
  IF p_product_ids IS NULL OR array_length(p_product_ids,1) IS NULL THEN
    RAISE EXCEPTION 'no_products' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('v2checkout:'||p_idempotency_key,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('v2user:'||p_actor_user_id::text,0));

  SELECT * INTO v_existing_order FROM public.orders
    WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing_order.user_id <> p_actor_user_id THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='23505';
    END IF;
    SELECT id INTO v_attempt_id FROM public.payment_attempts
      WHERE order_id = v_existing_order.id ORDER BY created_at DESC LIMIT 1;
    RETURN jsonb_build_object('ok',true,'idempotent_replay',true,
      'order_id',v_existing_order.id,'attempt_id',v_attempt_id,
      'total_fils',v_existing_order.total_fils,'status',v_existing_order.status::text);
  END IF;

  SELECT ARRAY(SELECT DISTINCT UNNEST(p_product_ids)) INTO v_dedup;

  SELECT EXISTS (
    SELECT 1 FROM public.entitlements
     WHERE user_id = p_actor_user_id
       AND scope = 'library'::public.v2_entitlement_scope
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_active_lifetime;
  IF v_active_lifetime THEN RAISE EXCEPTION 'already_lifetime' USING ERRCODE='22023'; END IF;

  v_products_count := 0;
  FOR v_product IN
    SELECT p.* FROM public.products p
     WHERE p.id = ANY(v_dedup) AND p.is_active = true
     ORDER BY p.id FOR UPDATE
  LOOP
    v_products_count := v_products_count + 1;
    IF v_product.currency <> 'KWD' THEN RAISE EXCEPTION 'invalid_currency' USING ERRCODE='22023'; END IF;
    IF v_product.product_type = 'free'::public.v2_product_type THEN
      RAISE EXCEPTION 'free_product_not_purchasable' USING ERRCODE='22023';
    END IF;
    IF v_product.price_fils IS NULL OR v_product.price_fils <= 0 THEN
      RAISE EXCEPTION 'invalid_product_price' USING ERRCODE='22023';
    END IF;
    IF v_product.product_type = 'lifetime'::public.v2_product_type THEN
      v_has_lifetime := true; v_lifetime_price := v_product.price_fils;
    ELSE
      v_has_non_lifetime := true; v_subtotal := v_subtotal + v_product.price_fils;
    END IF;
  END LOOP;

  IF v_products_count <> array_length(v_dedup,1) THEN
    RAISE EXCEPTION 'products_not_found_or_inactive' USING ERRCODE='P0002';
  END IF;
  IF v_has_lifetime AND v_has_non_lifetime THEN
    RAISE EXCEPTION 'lifetime_cannot_mix' USING ERRCODE='22023';
  END IF;
  IF v_has_lifetime AND array_length(v_dedup,1) <> 1 THEN
    RAISE EXCEPTION 'lifetime_must_be_alone' USING ERRCODE='22023';
  END IF;

  -- Ownership block, extended with collection scope --------------------
  WITH cart AS (
    SELECT p.id AS product_id, p.product_type, p.resource_id AS root
      FROM public.products p WHERE p.id = ANY(v_dedup)
  ),
  expanded AS (
    SELECT product_id, root AS resource_id FROM cart
     WHERE product_type = 'individual'::public.v2_product_type AND root IS NOT NULL
    UNION
    SELECT product_id, root FROM cart
     WHERE product_type = 'bundle'::public.v2_product_type AND root IS NOT NULL
    UNION
    SELECT c.product_id, pbi.resource_id
      FROM cart c JOIN public.product_bundle_items pbi
        ON pbi.bundle_product_id = c.product_id
     WHERE c.product_type = 'bundle'::public.v2_product_type
  ),
  expanded_ck AS (
    SELECT product_id, resource_id, public.v2_resource_collection_key(resource_id) AS ck
      FROM expanded
  ),
  owned AS (
    SELECT ec.product_id, ec.resource_id
      FROM expanded_ck ec
      JOIN public.entitlements ent
        ON ent.user_id = p_actor_user_id
       AND ent.revoked_at IS NULL
       AND (ent.expires_at IS NULL OR ent.expires_at > now())
       AND (
         (ent.scope = 'resource'::public.v2_entitlement_scope
          AND ent.resource_id = ec.resource_id)
         OR
         (ent.scope = 'collection'::public.v2_entitlement_scope
          AND ec.ck IS NOT NULL
          AND ent.collection_key = ec.ck)
       )
  )
  SELECT COALESCE(array_agg(DISTINCT product_id),'{}'),
         COALESCE(array_agg(DISTINCT resource_id),'{}')
    INTO v_already_owned_products, v_already_owned FROM owned;

  IF array_length(v_already_owned_products,1) IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'error','already_owned',
      'already_owned_product_ids', to_jsonb(v_already_owned_products),
      'already_owned_resource_ids', to_jsonb(v_already_owned));
  END IF;

  WITH cart AS (
    SELECT p.id AS product_id, p.product_type, p.resource_id AS root
      FROM public.products p WHERE p.id = ANY(v_dedup)
  ),
  expanded AS (
    SELECT product_id, root AS resource_id FROM cart WHERE root IS NOT NULL
    UNION ALL
    SELECT c.product_id, pbi.resource_id
      FROM cart c JOIN public.product_bundle_items pbi
        ON pbi.bundle_product_id = c.product_id
     WHERE c.product_type = 'bundle'::public.v2_product_type
  ),
  dupes AS (
    SELECT resource_id, array_agg(DISTINCT product_id) AS products
      FROM expanded GROUP BY resource_id
     HAVING count(DISTINCT product_id) > 1
  )
  SELECT COALESCE(array_agg(DISTINCT p),'{}') INTO v_overlap
    FROM dupes, LATERAL unnest(products) AS p;
  IF array_length(v_overlap,1) IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'error','overlapping_resource_products',
      'product_ids', to_jsonb(v_overlap));
  END IF;

  -- Pending order guard (unchanged) -----------------------------------
  IF v_has_lifetime THEN
    SELECT o.id, o.order_number INTO v_pending_conflict
      FROM public.orders o
     WHERE o.user_id = p_actor_user_id
       AND o.status = 'pending'::public.v2_order_status
       AND o.provider = 'upayments'
       AND o.created_at > now() - interval '2 hours'
       AND EXISTS (
         SELECT 1 FROM public.order_items oi
          JOIN public.products p ON p.id = oi.product_id
         WHERE oi.order_id = o.id
           AND p.product_type = 'lifetime'::public.v2_product_type
       )
     ORDER BY o.created_at DESC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('ok',false,'error','purchase_in_progress',
        'existing_order_id',v_pending_conflict.id,
        'existing_order_number',v_pending_conflict.order_number);
    END IF;
  ELSE
    WITH cart AS (
      SELECT p.id AS product_id, p.product_type, p.resource_id AS root
        FROM public.products p WHERE p.id = ANY(v_dedup)
    ),
    cart_res AS (
      SELECT root AS resource_id FROM cart WHERE root IS NOT NULL
      UNION
      SELECT pbi.resource_id FROM cart c
        JOIN public.product_bundle_items pbi ON pbi.bundle_product_id = c.product_id
       WHERE c.product_type = 'bundle'::public.v2_product_type
    ),
    pending_orders AS (
      SELECT o.id AS order_id, o.order_number, oi.product_id
        FROM public.orders o
        JOIN public.order_items oi ON oi.order_id = o.id
       WHERE o.user_id = p_actor_user_id
         AND o.status = 'pending'::public.v2_order_status
         AND o.provider = 'upayments'
         AND o.created_at > now() - interval '2 hours'
    ),
    pending_res AS (
      SELECT po.order_id, po.order_number, p.resource_id
        FROM pending_orders po JOIN public.products p ON p.id = po.product_id
       WHERE p.resource_id IS NOT NULL
      UNION
      SELECT po.order_id, po.order_number, pbi.resource_id
        FROM pending_orders po JOIN public.products p ON p.id = po.product_id
        JOIN public.product_bundle_items pbi ON pbi.bundle_product_id = p.id
       WHERE p.product_type = 'bundle'::public.v2_product_type
    )
    SELECT pr.order_id AS id, pr.order_number INTO v_pending_conflict
      FROM pending_res pr JOIN cart_res cr ON cr.resource_id = pr.resource_id LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('ok',false,'error','purchase_in_progress',
        'existing_order_id',v_pending_conflict.id,
        'existing_order_number',v_pending_conflict.order_number);
    END IF;
  END IF;

  IF v_has_lifetime THEN
    SELECT COALESCE(SUM(amount_fils),0) INTO v_credit
      FROM public.lifetime_credit_entries WHERE user_id = p_actor_user_id;
    IF v_credit < 0 THEN v_credit := 0; END IF;
    IF v_credit > v_lifetime_price THEN v_credit := v_lifetime_price; END IF;
    v_lifetime_credit_applied := v_credit;
    v_subtotal := v_lifetime_price;
  END IF;

  DECLARE v_base int; BEGIN
    v_base := CASE WHEN v_has_lifetime THEN v_lifetime_price - v_lifetime_credit_applied ELSE v_subtotal END;
    IF p_discount_code IS NOT NULL AND btrim(p_discount_code) <> '' THEN
      SELECT * INTO v_discount FROM public.v2_discount_codes
        WHERE code_normalized = lower(btrim(p_discount_code)) FOR UPDATE;
      IF NOT FOUND OR NOT v_discount.is_active OR v_discount.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'discount_invalid' USING ERRCODE='22023';
      END IF;
      IF v_discount.starts_at IS NOT NULL AND v_discount.starts_at > now() THEN
        RAISE EXCEPTION 'discount_not_started' USING ERRCODE='22023';
      END IF;
      IF v_discount.expires_at IS NOT NULL AND v_discount.expires_at < now() THEN
        RAISE EXCEPTION 'discount_expired' USING ERRCODE='22023';
      END IF;
      IF v_base < v_discount.min_order_fils THEN
        RAISE EXCEPTION 'discount_min_order' USING ERRCODE='22023';
      END IF;
      IF v_has_lifetime AND NOT v_discount.applies_to_lifetime THEN
        RAISE EXCEPTION 'discount_not_eligible_lifetime' USING ERRCODE='22023';
      END IF;
      IF NOT v_discount.applies_to_all THEN
        SELECT COALESCE(array_agg(pid),'{}') INTO v_uncovered_product_ids
          FROM unnest(v_dedup) AS pid
         WHERE NOT (pid = ANY(v_discount.applicable_product_ids));
        IF array_length(v_uncovered_product_ids,1) IS NOT NULL THEN
          RAISE EXCEPTION 'discount_scope_mismatch' USING ERRCODE='22023';
        END IF;
      END IF;
      IF v_discount.max_total_uses IS NOT NULL THEN
        SELECT count(*) INTO v_used_by FROM public.v2_discount_redemptions
          WHERE discount_code_id = v_discount.id AND status IN ('reserved','consumed');
        IF v_used_by >= v_discount.max_total_uses THEN
          RAISE EXCEPTION 'discount_exhausted' USING ERRCODE='22023';
        END IF;
      END IF;
      IF v_discount.max_uses_per_user IS NOT NULL THEN
        SELECT count(*) INTO v_used_by_user FROM public.v2_discount_redemptions
          WHERE discount_code_id = v_discount.id AND user_id = p_actor_user_id
            AND status IN ('reserved','consumed');
        IF v_used_by_user >= v_discount.max_uses_per_user THEN
          RAISE EXCEPTION 'discount_user_limit' USING ERRCODE='22023';
        END IF;
      END IF;
      IF v_discount.kind = 'percent' THEN v_discount_fils := (v_base * v_discount.value)/100;
      ELSE v_discount_fils := LEAST(v_discount.value, v_base); END IF;
      IF v_discount_fils < 0 THEN v_discount_fils := 0; END IF;
      IF v_discount_fils > v_base THEN v_discount_fils := v_base; END IF;
    END IF;
  END;

  v_total := v_subtotal - v_lifetime_credit_applied - v_discount_fils;
  IF v_total < 0 THEN v_total := 0; END IF;

  v_order_id := gen_random_uuid();
  v_order_number := 'JJ-'||to_char(now() AT TIME ZONE 'UTC','YYYYMMDDHH24MISS')||'-'||substring(v_order_id::text,1,6);
  v_merchant_ref := 'JJ'||substring(replace(v_order_id::text,'-',''),1,20);
  IF char_length(v_merchant_ref) > 40 THEN v_merchant_ref := substring(v_merchant_ref,1,40); END IF;
  v_provider := CASE WHEN v_total = 0 THEN 'internal' ELSE 'upayments' END;

  INSERT INTO public.orders (id, user_id, order_number, status, subtotal_fils, discount_fils,
                             total_fils, currency, paid_fils, discount_code, provider,
                             provider_reference, idempotency_key, placed_at, lifetime_credit_applied_fils)
  VALUES (v_order_id, p_actor_user_id, v_order_number, 'pending'::public.v2_order_status,
          v_subtotal, v_discount_fils, v_total, 'KWD', 0, NULLIF(p_discount_code,''),
          v_provider, NULL, p_idempotency_key, now(), v_lifetime_credit_applied);

  INSERT INTO public.order_items (order_id, product_id, resource_id, quantity,
                                  unit_price_fils, line_total_fils,
                                  resource_version_id, acquired_major_version)
  SELECT v_order_id, p.id, p.resource_id, 1, p.price_fils, p.price_fils,
         r.current_version_id, rv.major_version
    FROM public.products p
    LEFT JOIN public.resources r ON r.id = p.resource_id
    LEFT JOIN public.resource_versions rv ON rv.id = r.current_version_id
   WHERE p.id = ANY(v_dedup);

  v_attempt_id := gen_random_uuid();
  INSERT INTO public.payment_attempts (id, order_id, provider, merchant_reference,
                                       expected_amount_fils, currency, status)
  VALUES (v_attempt_id, v_order_id, v_provider, v_merchant_ref, v_total, 'KWD',
          CASE WHEN v_total = 0 THEN 'verified_paid' ELSE 'created' END);

  IF v_discount.id IS NOT NULL THEN
    INSERT INTO public.v2_discount_redemptions (discount_code_id, user_id, order_id, amount_discount_fils)
    VALUES (v_discount.id, p_actor_user_id, v_order_id, v_discount_fils);
  END IF;

  PERFORM public.v2_insert_or_verify_payment_event(
    v_order_id, v_provider, 'local:created:'||v_order_id::text,
    'created'::public.v2_payment_event_type, v_total, 'KWD',
    jsonb_build_object('kind','created','order_id',v_order_id,'attempt_id',v_attempt_id));

  IF v_total = 0 THEN
    PERFORM public.v2_insert_or_verify_payment_event(
      v_order_id, 'internal', 'local:captured:'||v_order_id::text,
      'captured'::public.v2_payment_event_type, 0, 'KWD',
      jsonb_build_object('kind','zero_total_internal','order_id',v_order_id));
    PERFORM public.v2_apply_paid_order_locked(v_order_id);
  END IF;

  RETURN jsonb_build_object(
    'ok',true,'order_id',v_order_id,'attempt_id',v_attempt_id,
    'order_number',v_order_number,'merchant_reference',v_merchant_ref,
    'subtotal_fils',v_subtotal,'discount_fils',v_discount_fils,
    'lifetime_credit_applied_fils',v_lifetime_credit_applied,
    'total_fils',v_total,'currency','KWD','provider',v_provider,
    'settled_internally', v_total = 0
  );
END $function$;

-- 9) Admin entitlement listing (expose collection_key) -------
CREATE OR REPLACE FUNCTION public.v2_admin_list_entitlements(
  p_scope text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid; v_limit int; v_offset int := GREATEST(COALESCE(p_offset,0),0);
  v_total bigint; v_rows jsonb;
  v_search text := NULLIF(trim(coalesce(p_search,'')), '');
BEGIN
  v_actor := public._v2_require_admin();
  v_limit := public._v2_bounded_limit(p_limit, 200);

  WITH filt AS (
    SELECT e.*, p.email AS user_email, r.title AS resource_title, r.type AS resource_type_col
    FROM public.entitlements e
    LEFT JOIN public.profiles p ON p.id = e.user_id
    LEFT JOIN public.resources r ON r.id = e.resource_id
    WHERE (p_scope IS NULL OR e.scope::text = p_scope)
      AND (p_reason IS NULL OR e.grant_reason::text = p_reason)
      AND (
        p_state IS NULL
        OR (p_state='active'  AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now()))
        OR (p_state='revoked' AND e.revoked_at IS NOT NULL)
        OR (p_state='expired' AND e.expires_at IS NOT NULL AND e.expires_at <= now() AND e.revoked_at IS NULL)
      )
      AND (
        v_search IS NULL
        OR p.email ILIKE '%'||v_search||'%'
        OR r.title ILIKE '%'||v_search||'%'
        OR e.collection_key ILIKE '%'||v_search||'%'
      )
  ), page AS (
    SELECT * FROM filt ORDER BY granted_at DESC LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT COUNT(*) FROM filt),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', p.id, 'user_id', p.user_id,
           'user_email_masked', public._v2_mask_email(p.user_email),
           'scope', p.scope, 'collection_key', p.collection_key,
           'resource_id', p.resource_id, 'resource_title', p.resource_title,
           'resource_type', p.resource_type_col,
           'grant_reason', p.grant_reason, 'order_id', p.order_id,
           'source_order_item_id', p.source_order_item_id,
           'granted_at', p.granted_at, 'revoked_at', p.revoked_at,
           'revoke_reason', p.revoke_reason, 'expires_at', p.expires_at,
           'version_major', p.version_major,
           'state', CASE
             WHEN p.revoked_at IS NOT NULL THEN 'revoked'
             WHEN p.expires_at IS NOT NULL AND p.expires_at <= now() THEN 'expired'
             ELSE 'active'
           END
         ) ORDER BY p.granted_at DESC), '[]'::jsonb)
  INTO v_total, v_rows
  FROM page p;

  RETURN jsonb_build_object('total_count', v_total, 'rows', v_rows, 'limit', v_limit, 'offset', v_offset);
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_list_entitlements(text,text,text,text,int,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_entitlements(text,text,text,text,int,int) TO authenticated;
