
-- =========================================================================
-- Phase 5.4 — V2 Discount Codes hardening & admin operations
-- Forward-only; no destructive changes; historical redemption snapshots preserved.
-- =========================================================================

-- 1) Schema extensions ----------------------------------------------------
ALTER TABLE public.v2_discount_codes
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applies_to_lifetime boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS applicable_product_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Scope validity: if not applies_to_all, must list at least one product id
ALTER TABLE public.v2_discount_codes
  DROP CONSTRAINT IF EXISTS v2_discount_scope_nonempty;
ALTER TABLE public.v2_discount_codes
  ADD CONSTRAINT v2_discount_scope_nonempty
  CHECK (applies_to_all OR array_length(applicable_product_ids, 1) > 0);

-- Window validity
ALTER TABLE public.v2_discount_codes
  DROP CONSTRAINT IF EXISTS v2_discount_window_ordered;
ALTER TABLE public.v2_discount_codes
  ADD CONSTRAINT v2_discount_window_ordered
  CHECK (starts_at IS NULL OR expires_at IS NULL OR expires_at > starts_at);

-- Unique code among non-archived rows
DROP INDEX IF EXISTS v2_discount_codes_code_normalized_active_uidx;
CREATE UNIQUE INDEX v2_discount_codes_code_normalized_active_uidx
  ON public.v2_discount_codes (code_normalized)
  WHERE archived_at IS NULL;

-- Normalization + updated_at trigger
CREATE OR REPLACE FUNCTION public._v2_discount_codes_biu()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.code IS NULL OR btrim(NEW.code) = '' THEN
    RAISE EXCEPTION 'code_required' USING ERRCODE='22023';
  END IF;
  NEW.code := btrim(NEW.code);
  NEW.code_normalized := lower(NEW.code);
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS v2_discount_codes_biu ON public.v2_discount_codes;
CREATE TRIGGER v2_discount_codes_biu
  BEFORE INSERT OR UPDATE ON public.v2_discount_codes
  FOR EACH ROW EXECUTE FUNCTION public._v2_discount_codes_biu();

REVOKE ALL ON FUNCTION public._v2_discount_codes_biu() FROM PUBLIC, anon, authenticated, service_role;

-- =========================================================================
-- 2) Updated v2_create_checkout_order with eligibility gates
--    (Full rewrite: preserves every existing check; adds:
--     - archived_at IS NULL
--     - applies_to_lifetime gate for lifetime carts
--     - applicable_product_ids scope check when NOT applies_to_all)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_create_checkout_order(
  p_actor_user_id uuid,
  p_product_ids uuid[],
  p_idempotency_key text,
  p_discount_code text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_dedup uuid[];
  v_product record;
  v_products_count int;
  v_has_lifetime boolean := false;
  v_has_non_lifetime boolean := false;
  v_subtotal int := 0;
  v_lifetime_price int := 30000;
  v_credit int := 0;
  v_lifetime_credit_applied int := 0;
  v_active_lifetime boolean := false;
  v_already_owned uuid[] := '{}';
  v_already_owned_products uuid[] := '{}';
  v_overlap uuid[] := '{}';
  v_order_id uuid;
  v_order_number text;
  v_merchant_ref text;
  v_attempt_id uuid;
  v_discount record;
  v_discount_fils int := 0;
  v_total int := 0;
  v_provider text;
  v_existing_order record;
  v_used_by int;
  v_used_by_user int;
  v_pending_conflict record;
  v_uncovered_product_ids uuid[];
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_actor_user_id) THEN
    RAISE EXCEPTION 'actor_not_found' USING ERRCODE='P0002';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' OR char_length(p_idempotency_key) > 120 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE='22023';
  END IF;
  IF p_product_ids IS NULL OR array_length(p_product_ids,1) IS NULL THEN
    RAISE EXCEPTION 'no_products' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('v2checkout:'||p_idempotency_key, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('v2user:'||p_actor_user_id::text, 0));

  SELECT * INTO v_existing_order FROM public.orders
    WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing_order.user_id <> p_actor_user_id THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='23505';
    END IF;
    SELECT id INTO v_attempt_id FROM public.payment_attempts
     WHERE order_id = v_existing_order.id ORDER BY created_at DESC LIMIT 1;
    RETURN jsonb_build_object('ok', true, 'idempotent_replay', true,
      'order_id', v_existing_order.id, 'attempt_id', v_attempt_id,
      'total_fils', v_existing_order.total_fils, 'status', v_existing_order.status::text);
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
      v_has_lifetime := true;
      v_lifetime_price := v_product.price_fils;
    ELSE
      v_has_non_lifetime := true;
      v_subtotal := v_subtotal + v_product.price_fils;
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

  -- Per-resource ownership block (unchanged) ----------------------------
  WITH cart AS (
    SELECT p.id AS product_id, p.product_type, p.resource_id AS root
      FROM public.products p WHERE p.id = ANY(v_dedup)
  ),
  expanded AS (
    SELECT product_id, root AS resource_id FROM cart
     WHERE product_type = 'individual'::public.v2_product_type
       AND root IS NOT NULL
    UNION
    SELECT product_id, root FROM cart
     WHERE product_type = 'bundle'::public.v2_product_type
       AND root IS NOT NULL
    UNION
    SELECT c.product_id, pbi.resource_id
      FROM cart c JOIN public.product_bundle_items pbi
        ON pbi.bundle_product_id = c.product_id
     WHERE c.product_type = 'bundle'::public.v2_product_type
  ),
  owned AS (
    SELECT e.product_id, e.resource_id
      FROM expanded e
      JOIN public.entitlements ent
        ON ent.user_id = p_actor_user_id
       AND ent.resource_id = e.resource_id
       AND ent.scope = 'resource'::public.v2_entitlement_scope
       AND ent.revoked_at IS NULL
       AND (ent.expires_at IS NULL OR ent.expires_at > now())
  )
  SELECT COALESCE(array_agg(DISTINCT product_id),'{}'),
         COALESCE(array_agg(DISTINCT resource_id),'{}')
    INTO v_already_owned_products, v_already_owned
    FROM owned;

  IF array_length(v_already_owned_products,1) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_owned',
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
    RETURN jsonb_build_object('ok', false, 'error', 'overlapping_resource_products',
      'product_ids', to_jsonb(v_overlap));
  END IF;

  -- Pending upayments order guard (unchanged) ---------------------------
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
      RETURN jsonb_build_object('ok', false, 'error', 'purchase_in_progress',
        'existing_order_id', v_pending_conflict.id,
        'existing_order_number', v_pending_conflict.order_number);
    END IF;
  ELSE
    WITH cart AS (
      SELECT p.id AS product_id, p.product_type, p.resource_id AS root
        FROM public.products p WHERE p.id = ANY(v_dedup)
    ),
    cart_res AS (
      SELECT root AS resource_id FROM cart WHERE root IS NOT NULL
      UNION
      SELECT pbi.resource_id
        FROM cart c JOIN public.product_bundle_items pbi
          ON pbi.bundle_product_id = c.product_id
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
        FROM pending_orders po
        JOIN public.products p ON p.id = po.product_id
       WHERE p.resource_id IS NOT NULL
      UNION
      SELECT po.order_id, po.order_number, pbi.resource_id
        FROM pending_orders po
        JOIN public.products p ON p.id = po.product_id
        JOIN public.product_bundle_items pbi ON pbi.bundle_product_id = p.id
       WHERE p.product_type = 'bundle'::public.v2_product_type
    )
    SELECT pr.order_id AS id, pr.order_number
      INTO v_pending_conflict
      FROM pending_res pr
      JOIN cart_res cr ON cr.resource_id = pr.resource_id
     LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'purchase_in_progress',
        'existing_order_id', v_pending_conflict.id,
        'existing_order_number', v_pending_conflict.order_number);
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

  -- Discount evaluation (server-authoritative) --------------------------
  DECLARE v_base int; BEGIN
    v_base := CASE WHEN v_has_lifetime THEN v_lifetime_price - v_lifetime_credit_applied
                   ELSE v_subtotal END;
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

      -- NEW: lifetime eligibility gate (explicit only).
      IF v_has_lifetime AND NOT v_discount.applies_to_lifetime THEN
        RAISE EXCEPTION 'discount_not_eligible_lifetime' USING ERRCODE='22023';
      END IF;

      -- NEW: product-scope gate. Every product in the cart must appear
      -- in applicable_product_ids when applies_to_all is false.
      IF NOT v_discount.applies_to_all THEN
        SELECT COALESCE(array_agg(pid),'{}')
          INTO v_uncovered_product_ids
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
      IF v_discount.kind = 'percent' THEN
        v_discount_fils := (v_base * v_discount.value) / 100;
      ELSE
        v_discount_fils := LEAST(v_discount.value, v_base);
      END IF;
      IF v_discount_fils < 0 THEN v_discount_fils := 0; END IF;
      IF v_discount_fils > v_base THEN v_discount_fils := v_base; END IF;
    END IF;
  END;

  v_total := v_subtotal - v_lifetime_credit_applied - v_discount_fils;
  IF v_total < 0 THEN v_total := 0; END IF;

  v_order_id := gen_random_uuid();
  v_order_number := 'JJ-' || to_char(now() AT TIME ZONE 'UTC','YYYYMMDDHH24MISS') || '-' || substring(v_order_id::text,1,6);
  v_merchant_ref := 'JJ' || substring(replace(v_order_id::text,'-',''),1,20);
  IF char_length(v_merchant_ref) > 40 THEN v_merchant_ref := substring(v_merchant_ref,1,40); END IF;
  v_provider := CASE WHEN v_total = 0 THEN 'internal' ELSE 'upayments' END;

  INSERT INTO public.orders (id, user_id, order_number, status, subtotal_fils, discount_fils,
                             total_fils, currency, paid_fils, discount_code, provider,
                             provider_reference, idempotency_key, placed_at,
                             lifetime_credit_applied_fils)
  VALUES (v_order_id, p_actor_user_id, v_order_number, 'pending'::public.v2_order_status,
          v_subtotal, v_discount_fils, v_total, 'KWD', 0,
          NULLIF(p_discount_code,''), v_provider, NULL, p_idempotency_key, now(),
          v_lifetime_credit_applied);

  INSERT INTO public.order_items (order_id, product_id, resource_id, quantity,
                                  unit_price_fils, line_total_fils,
                                  resource_version_id, acquired_major_version)
  SELECT v_order_id, p.id, p.resource_id, 1,
         p.price_fils, p.price_fils,
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
    v_order_id, v_provider, 'local:created:' || v_order_id::text,
    'created'::public.v2_payment_event_type, v_total, 'KWD',
    jsonb_build_object('kind','created','order_id',v_order_id,'attempt_id',v_attempt_id));

  IF v_total = 0 THEN
    PERFORM public.v2_insert_or_verify_payment_event(
      v_order_id, 'internal', 'local:captured:' || v_order_id::text,
      'captured'::public.v2_payment_event_type, 0, 'KWD',
      jsonb_build_object('kind','zero_total_internal','order_id',v_order_id));
    PERFORM public.v2_apply_paid_order_locked(v_order_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'order_id', v_order_id, 'attempt_id', v_attempt_id,
    'order_number', v_order_number, 'merchant_reference', v_merchant_ref,
    'subtotal_fils', v_subtotal, 'discount_fils', v_discount_fils,
    'lifetime_credit_applied_fils', v_lifetime_credit_applied,
    'total_fils', v_total, 'currency', 'KWD', 'provider', v_provider,
    'settled_internally', v_total = 0
  );
END $function$;

-- =========================================================================
-- 3) Admin RPCs for discount management
-- =========================================================================

-- Derived status label for the admin view.
CREATE OR REPLACE FUNCTION public._v2_discount_status_label(
  p_is_active boolean,
  p_archived_at timestamptz,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_max_total_uses int,
  p_used_count int
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $$
  SELECT CASE
    WHEN p_archived_at IS NOT NULL THEN 'archived'
    WHEN NOT p_is_active THEN 'inactive'
    WHEN p_expires_at IS NOT NULL AND p_expires_at < now() THEN 'expired'
    WHEN p_starts_at IS NOT NULL AND p_starts_at > now() THEN 'scheduled'
    WHEN p_max_total_uses IS NOT NULL AND p_used_count >= p_max_total_uses THEN 'exhausted'
    ELSE 'active'
  END
$$;
REVOKE ALL ON FUNCTION public._v2_discount_status_label(boolean,timestamptz,timestamptz,timestamptz,int,int)
  FROM PUBLIC, anon, authenticated, service_role;

-- 3a) List admin discounts (paged)
CREATE OR REPLACE FUNCTION public.v2_admin_list_discounts(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,   -- one of: active|scheduled|expired|exhausted|inactive|archived
  p_kind   text DEFAULT NULL,   -- percent | fixed_fils
  p_limit  int  DEFAULT 50,
  p_offset int  DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := public._v2_require_admin();
  v_total bigint;
  v_rows  jsonb;
  v_lim   int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_off   int := GREATEST(COALESCE(p_offset, 0), 0);
  v_search text := NULLIF(btrim(COALESCE(p_search,'')), '');
BEGIN
  WITH base AS (
    SELECT d.*,
           (SELECT count(*)::int FROM public.v2_discount_redemptions r
              WHERE r.discount_code_id = d.id AND r.status IN ('reserved','consumed')) AS used_count,
           (SELECT count(*)::int FROM public.v2_discount_redemptions r
              WHERE r.discount_code_id = d.id AND r.status = 'consumed') AS consumed_count
      FROM public.v2_discount_codes d
  ),
  labeled AS (
    SELECT b.*,
      public._v2_discount_status_label(b.is_active, b.archived_at, b.starts_at, b.expires_at,
                                       b.max_total_uses, b.used_count) AS status_label
      FROM base b
  ),
  filtered AS (
    SELECT * FROM labeled
     WHERE (v_search IS NULL OR code_normalized LIKE '%'||lower(v_search)||'%')
       AND (p_status IS NULL OR status_label = p_status)
       AND (p_kind   IS NULL OR kind = p_kind)
  )
  SELECT count(*)::bigint INTO v_total FROM filtered;

  WITH base AS (
    SELECT d.*,
           (SELECT count(*)::int FROM public.v2_discount_redemptions r
              WHERE r.discount_code_id = d.id AND r.status IN ('reserved','consumed')) AS used_count,
           (SELECT count(*)::int FROM public.v2_discount_redemptions r
              WHERE r.discount_code_id = d.id AND r.status = 'consumed') AS consumed_count
      FROM public.v2_discount_codes d
  ),
  labeled AS (
    SELECT b.*,
      public._v2_discount_status_label(b.is_active, b.archived_at, b.starts_at, b.expires_at,
                                       b.max_total_uses, b.used_count) AS status_label
      FROM base b
  ),
  filtered AS (
    SELECT * FROM labeled
     WHERE (v_search IS NULL OR code_normalized LIKE '%'||lower(v_search)||'%')
       AND (p_status IS NULL OR status_label = p_status)
       AND (p_kind   IS NULL OR kind = p_kind)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'code', code,
    'code_normalized', code_normalized,
    'kind', kind,
    'value', value,
    'starts_at', starts_at,
    'expires_at', expires_at,
    'min_order_fils', min_order_fils,
    'max_total_uses', max_total_uses,
    'max_uses_per_user', max_uses_per_user,
    'applies_to_all', applies_to_all,
    'applies_to_lifetime', applies_to_lifetime,
    'applicable_product_ids', to_jsonb(applicable_product_ids),
    'applicable_product_count', COALESCE(array_length(applicable_product_ids,1),0),
    'is_active', is_active,
    'archived_at', archived_at,
    'status', status_label,
    'used_count', used_count,
    'consumed_count', consumed_count,
    'created_at', created_at,
    'updated_at', updated_at
  ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT * FROM filtered
     ORDER BY created_at DESC
     LIMIT v_lim OFFSET v_off
  ) f;

  RETURN jsonb_build_object(
    'total_count', COALESCE(v_total,0),
    'rows', v_rows,
    'limit', v_lim,
    'offset', v_off
  );
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_list_discounts(text,text,text,int,int) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_discounts(text,text,text,int,int) TO authenticated;

-- 3b) Detail with product summary
CREATE OR REPLACE FUNCTION public.v2_admin_get_discount(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := public._v2_require_admin();
  v_d record;
  v_used int;
  v_consumed int;
  v_products jsonb;
BEGIN
  SELECT * INTO v_d FROM public.v2_discount_codes WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;

  SELECT count(*)::int INTO v_used
    FROM public.v2_discount_redemptions
   WHERE discount_code_id = v_d.id AND status IN ('reserved','consumed');
  SELECT count(*)::int INTO v_consumed
    FROM public.v2_discount_redemptions
   WHERE discount_code_id = v_d.id AND status = 'consumed';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'title', p.title, 'product_type', p.product_type,
    'price_fils', p.price_fils, 'is_active', p.is_active
  ) ORDER BY p.title), '[]'::jsonb)
    INTO v_products
    FROM public.products p
   WHERE p.id = ANY(v_d.applicable_product_ids);

  RETURN jsonb_build_object(
    'id', v_d.id,
    'code', v_d.code,
    'code_normalized', v_d.code_normalized,
    'kind', v_d.kind,
    'value', v_d.value,
    'starts_at', v_d.starts_at,
    'expires_at', v_d.expires_at,
    'min_order_fils', v_d.min_order_fils,
    'max_total_uses', v_d.max_total_uses,
    'max_uses_per_user', v_d.max_uses_per_user,
    'applies_to_all', v_d.applies_to_all,
    'applies_to_lifetime', v_d.applies_to_lifetime,
    'applicable_product_ids', to_jsonb(v_d.applicable_product_ids),
    'applicable_products', v_products,
    'is_active', v_d.is_active,
    'archived_at', v_d.archived_at,
    'notes', v_d.notes,
    'status', public._v2_discount_status_label(
      v_d.is_active, v_d.archived_at, v_d.starts_at, v_d.expires_at,
      v_d.max_total_uses, v_used),
    'used_count', v_used,
    'consumed_count', v_consumed,
    'created_at', v_d.created_at,
    'updated_at', v_d.updated_at
  );
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_get_discount(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_get_discount(uuid) TO authenticated;

-- 3c) Upsert (create or edit). Blocks editing of `code`/`kind`/`value`/`applies_to_lifetime`
--     once the code has consumed redemptions to preserve historical semantics.
CREATE OR REPLACE FUNCTION public.v2_admin_upsert_discount(
  p_id uuid,
  p_code text,
  p_kind text,
  p_value int,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_min_order_fils int,
  p_max_total_uses int,
  p_max_uses_per_user int,
  p_applies_to_all boolean,
  p_applies_to_lifetime boolean,
  p_applicable_product_ids uuid[],
  p_is_active boolean,
  p_notes text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := public._v2_require_admin();
  v_id uuid;
  v_existing record;
  v_used int;
  v_norm text;
  v_action text;
  v_conflict uuid;
  v_missing uuid[];
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RAISE EXCEPTION 'code_required' USING ERRCODE='22023';
  END IF;
  IF p_kind NOT IN ('percent','fixed_fils') THEN
    RAISE EXCEPTION 'invalid_kind' USING ERRCODE='22023';
  END IF;
  IF p_value IS NULL OR p_value <= 0 THEN
    RAISE EXCEPTION 'invalid_value' USING ERRCODE='22023';
  END IF;
  IF p_kind = 'percent' AND (p_value < 1 OR p_value > 100) THEN
    RAISE EXCEPTION 'percent_out_of_range' USING ERRCODE='22023';
  END IF;
  IF p_min_order_fils IS NULL OR p_min_order_fils < 0 THEN
    RAISE EXCEPTION 'invalid_min_order' USING ERRCODE='22023';
  END IF;
  IF p_max_total_uses IS NOT NULL AND p_max_total_uses <= 0 THEN
    RAISE EXCEPTION 'invalid_max_total_uses' USING ERRCODE='22023';
  END IF;
  IF p_max_uses_per_user IS NOT NULL AND p_max_uses_per_user <= 0 THEN
    RAISE EXCEPTION 'invalid_max_uses_per_user' USING ERRCODE='22023';
  END IF;
  IF p_starts_at IS NOT NULL AND p_expires_at IS NOT NULL AND p_expires_at <= p_starts_at THEN
    RAISE EXCEPTION 'window_invalid' USING ERRCODE='22023';
  END IF;
  IF (NOT p_applies_to_all) AND (p_applicable_product_ids IS NULL OR array_length(p_applicable_product_ids,1) IS NULL) THEN
    RAISE EXCEPTION 'scope_products_required' USING ERRCODE='22023';
  END IF;

  v_norm := lower(btrim(p_code));

  -- validate product IDs actually exist and are v2 products.
  IF (NOT p_applies_to_all) THEN
    SELECT COALESCE(array_agg(pid),'{}') INTO v_missing
      FROM unnest(p_applicable_product_ids) pid
     WHERE NOT EXISTS (SELECT 1 FROM public.products x WHERE x.id = pid);
    IF array_length(v_missing,1) IS NOT NULL THEN
      RAISE EXCEPTION 'unknown_products' USING ERRCODE='P0002';
    END IF;
  END IF;

  IF p_id IS NULL THEN
    v_action := 'create';

    -- unique among non-archived
    SELECT id INTO v_conflict FROM public.v2_discount_codes
      WHERE code_normalized = v_norm AND archived_at IS NULL LIMIT 1;
    IF v_conflict IS NOT NULL THEN
      RAISE EXCEPTION 'code_conflict' USING ERRCODE='23505';
    END IF;

    INSERT INTO public.v2_discount_codes (
      code, kind, value, starts_at, expires_at, min_order_fils,
      max_total_uses, max_uses_per_user, applies_to_all,
      applies_to_lifetime, applicable_product_ids, is_active, notes,
      created_by, updated_by
    ) VALUES (
      p_code, p_kind, p_value, p_starts_at, p_expires_at, p_min_order_fils,
      p_max_total_uses, p_max_uses_per_user, COALESCE(p_applies_to_all,true),
      COALESCE(p_applies_to_lifetime,false),
      CASE WHEN p_applies_to_all THEN '{}'::uuid[] ELSE p_applicable_product_ids END,
      COALESCE(p_is_active,true), NULLIF(btrim(COALESCE(p_notes,'')),''),
      v_actor, v_actor
    ) RETURNING id INTO v_id;
  ELSE
    v_action := 'update';
    SELECT * INTO v_existing FROM public.v2_discount_codes WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
    IF v_existing.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'archived_immutable' USING ERRCODE='22023';
    END IF;

    SELECT count(*)::int INTO v_used
      FROM public.v2_discount_redemptions
     WHERE discount_code_id = v_existing.id AND status IN ('reserved','consumed');

    IF v_used > 0 THEN
      IF v_existing.code_normalized <> v_norm
         OR v_existing.kind <> p_kind
         OR v_existing.value <> p_value
         OR v_existing.applies_to_lifetime <> COALESCE(p_applies_to_lifetime,false) THEN
        RAISE EXCEPTION 'used_code_immutable_fields' USING ERRCODE='22023';
      END IF;
    ELSE
      -- unique among non-archived (excluding self)
      SELECT id INTO v_conflict FROM public.v2_discount_codes
        WHERE code_normalized = v_norm AND archived_at IS NULL AND id <> p_id LIMIT 1;
      IF v_conflict IS NOT NULL THEN
        RAISE EXCEPTION 'code_conflict' USING ERRCODE='23505';
      END IF;
    END IF;

    UPDATE public.v2_discount_codes SET
      code = p_code,
      kind = p_kind,
      value = p_value,
      starts_at = p_starts_at,
      expires_at = p_expires_at,
      min_order_fils = p_min_order_fils,
      max_total_uses = p_max_total_uses,
      max_uses_per_user = p_max_uses_per_user,
      applies_to_all = COALESCE(p_applies_to_all,true),
      applies_to_lifetime = COALESCE(p_applies_to_lifetime,false),
      applicable_product_ids = CASE WHEN p_applies_to_all THEN '{}'::uuid[] ELSE p_applicable_product_ids END,
      is_active = COALESCE(p_is_active,true),
      notes = NULLIF(btrim(COALESCE(p_notes,'')),''),
      updated_by = v_actor
    WHERE id = p_id;
    v_id := p_id;
  END IF;

  INSERT INTO public.activity_events (actor_user_id, actor_type, entity_type, entity_id, action, metadata)
  VALUES (v_actor, 'admin', 'v2_discount_code', v_id, 'v2_discount_' || v_action,
    jsonb_build_object('code', p_code, 'kind', p_kind, 'value', p_value,
      'applies_to_all', p_applies_to_all,
      'applies_to_lifetime', p_applies_to_lifetime,
      'is_active', p_is_active));

  RETURN public.v2_admin_get_discount(v_id);
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_upsert_discount(uuid,text,text,int,timestamptz,timestamptz,int,int,int,boolean,boolean,uuid[],boolean,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_upsert_discount(uuid,text,text,int,timestamptz,timestamptz,int,int,int,boolean,boolean,uuid[],boolean,text)
  TO authenticated;

-- 3d) Activate/deactivate toggle
CREATE OR REPLACE FUNCTION public.v2_admin_set_discount_active(p_id uuid, p_is_active boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := public._v2_require_admin();
  v_d record;
BEGIN
  SELECT * INTO v_d FROM public.v2_discount_codes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  IF v_d.archived_at IS NOT NULL THEN RAISE EXCEPTION 'archived_immutable' USING ERRCODE='22023'; END IF;
  IF v_d.is_active = p_is_active THEN
    RETURN public.v2_admin_get_discount(p_id);
  END IF;
  UPDATE public.v2_discount_codes SET is_active = p_is_active, updated_by = v_actor WHERE id = p_id;
  INSERT INTO public.activity_events (actor_user_id, actor_type, entity_type, entity_id, action, metadata)
  VALUES (v_actor, 'admin', 'v2_discount_code', p_id,
          CASE WHEN p_is_active THEN 'v2_discount_activate' ELSE 'v2_discount_deactivate' END,
          jsonb_build_object('code', v_d.code));
  RETURN public.v2_admin_get_discount(p_id);
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_set_discount_active(uuid,boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_set_discount_active(uuid,boolean) TO authenticated;

-- 3e) Archive (soft). Never hard-deletes. Deactivates too.
CREATE OR REPLACE FUNCTION public.v2_admin_archive_discount(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := public._v2_require_admin();
  v_d record;
BEGIN
  SELECT * INTO v_d FROM public.v2_discount_codes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
  IF v_d.archived_at IS NOT NULL THEN
    RETURN public.v2_admin_get_discount(p_id);
  END IF;
  UPDATE public.v2_discount_codes
     SET archived_at = now(), archived_by = v_actor,
         is_active = false, updated_by = v_actor
   WHERE id = p_id;
  INSERT INTO public.activity_events (actor_user_id, actor_type, entity_type, entity_id, action, metadata)
  VALUES (v_actor, 'admin', 'v2_discount_code', p_id, 'v2_discount_archive',
          jsonb_build_object('code', v_d.code));
  RETURN public.v2_admin_get_discount(p_id);
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_archive_discount(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_archive_discount(uuid) TO authenticated;

-- 3f) Product picker (search active products for the edit dialog)
CREATE OR REPLACE FUNCTION public.v2_admin_search_products_for_discount(
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 20
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := public._v2_require_admin();
  v_rows jsonb;
  v_s text := NULLIF(btrim(COALESCE(p_search,'')),'');
  v_lim int := LEAST(GREATEST(COALESCE(p_limit,20),1),100);
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'title', p.title, 'product_type', p.product_type,
    'price_fils', p.price_fils, 'is_active', p.is_active
  ) ORDER BY p.title), '[]'::jsonb) INTO v_rows FROM (
    SELECT * FROM public.products p
      WHERE (v_s IS NULL OR lower(p.title) LIKE '%'||lower(v_s)||'%')
        AND p.product_type <> 'free'::public.v2_product_type
      ORDER BY p.is_active DESC, p.title ASC
      LIMIT v_lim
  ) p;
  RETURN v_rows;
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_search_products_for_discount(text,int) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_search_products_for_discount(text,int) TO authenticated;
