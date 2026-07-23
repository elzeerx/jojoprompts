
-- Corrective migration: fix pending-order overlap coverage and unify
-- user-scoped advisory lock key between checkout and settlement.

CREATE OR REPLACE FUNCTION public.v2_create_checkout_order(
  p_actor_user_id uuid,
  p_product_ids uuid[],
  p_idempotency_key text,
  p_discount_code text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

  -- Per-resource ownership block for both individual and bundle-item resources.
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

  -- Pending upayments order guard (last 2 hours).
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
    -- Cart expanded coverage (roots + bundle member resources).
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
    -- Pending order coverage: each pending product's root PLUS every
    -- bundle-item resource (not COALESCE, which loses bundle members
    -- whenever the bundle product has its own root resource).
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

  DECLARE v_base int; BEGIN
    v_base := CASE WHEN v_has_lifetime THEN v_lifetime_price - v_lifetime_credit_applied
                   ELSE v_subtotal END;
    IF p_discount_code IS NOT NULL AND btrim(p_discount_code) <> '' THEN
      SELECT * INTO v_discount FROM public.v2_discount_codes
        WHERE code_normalized = lower(btrim(p_discount_code)) FOR UPDATE;
      IF NOT FOUND OR NOT v_discount.is_active THEN RAISE EXCEPTION 'discount_invalid' USING ERRCODE='22023'; END IF;
      IF v_discount.starts_at IS NOT NULL AND v_discount.starts_at > now() THEN RAISE EXCEPTION 'discount_not_started' USING ERRCODE='22023'; END IF;
      IF v_discount.expires_at IS NOT NULL AND v_discount.expires_at < now() THEN RAISE EXCEPTION 'discount_expired' USING ERRCODE='22023'; END IF;
      IF v_base < v_discount.min_order_fils THEN RAISE EXCEPTION 'discount_min_order' USING ERRCODE='22023'; END IF;
      IF v_discount.max_total_uses IS NOT NULL THEN
        SELECT count(*) INTO v_used_by FROM public.v2_discount_redemptions
          WHERE discount_code_id = v_discount.id AND status IN ('reserved','consumed');
        IF v_used_by >= v_discount.max_total_uses THEN RAISE EXCEPTION 'discount_exhausted' USING ERRCODE='22023'; END IF;
      END IF;
      IF v_discount.max_uses_per_user IS NOT NULL THEN
        SELECT count(*) INTO v_used_by_user FROM public.v2_discount_redemptions
          WHERE discount_code_id = v_discount.id AND user_id = p_actor_user_id AND status IN ('reserved','consumed');
        IF v_used_by_user >= v_discount.max_uses_per_user THEN RAISE EXCEPTION 'discount_user_limit' USING ERRCODE='22023'; END IF;
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

-- Unify user-scoped advisory key with checkout ('v2user:'||user_id) so
-- concurrent checkout and settlement for the same user serialize.
CREATE OR REPLACE FUNCTION public.v2_apply_paid_order_locked(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order    record;
  v_item     record;
  v_bi       record;
  v_major int;
  v_settled_paid_fils int;
  v_sum_line int;
  v_alloc_sum int := 0;
  v_credit_after int;
  v_granted_lifetime_purchase boolean := false;
  v_granted_lifetime_threshold boolean := false;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;

  IF v_order.status = 'paid'::public.v2_order_status THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true,
      'order_id', v_order.id, 'paid_fils', v_order.paid_fils);
  END IF;

  IF v_order.status IN ('refunded'::public.v2_order_status,
                        'partially_refunded'::public.v2_order_status) THEN
    RAISE EXCEPTION 'order_not_settleable' USING ERRCODE='22023';
  END IF;

  -- Same key as checkout to serialize per-user state changes.
  PERFORM pg_advisory_xact_lock(hashtextextended('v2user:'||v_order.user_id::text, 0));

  v_settled_paid_fils := v_order.total_fils;

  UPDATE public.orders
     SET status      = 'paid'::public.v2_order_status,
         paid_fils   = v_settled_paid_fils,
         placed_at   = COALESCE(v_order.placed_at, now()),
         settled_at  = now(),
         updated_at  = now()
   WHERE id = v_order.id;

  SELECT COALESCE(SUM(line_total_fils),0) INTO v_sum_line
    FROM public.order_items WHERE order_id = v_order.id;

  IF v_sum_line = 0 THEN
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY id) AS rn,
             count(*) OVER () AS total_rows
        FROM public.order_items WHERE order_id = v_order.id
    ), computed AS (
      SELECT id,
             (v_settled_paid_fils / NULLIF(total_rows,0))
               + CASE WHEN rn <= (v_settled_paid_fils - (v_settled_paid_fils / NULLIF(total_rows,0)) * total_rows)
                      THEN 1 ELSE 0 END AS alloc
        FROM ranked
    )
    UPDATE public.order_items oi
       SET paid_allocation_fils = computed.alloc
      FROM computed
     WHERE oi.id = computed.id;
  ELSE
    WITH base AS (
      SELECT id, line_total_fils,
             (line_total_fils::bigint * v_settled_paid_fils) / v_sum_line AS floor_alloc,
             ((line_total_fils::bigint * v_settled_paid_fils) % v_sum_line) AS remainder_num
        FROM public.order_items WHERE order_id = v_order.id
    ), s AS (
      SELECT COALESCE(SUM(floor_alloc),0)::bigint AS total_floor FROM base
    ), ranked AS (
      SELECT b.id, b.floor_alloc, b.remainder_num,
             row_number() OVER (ORDER BY b.remainder_num DESC, b.id ASC) AS rn
        FROM base b
    ), computed AS (
      SELECT r.id,
             (r.floor_alloc
              + CASE WHEN r.rn <= (v_settled_paid_fils - (SELECT total_floor FROM s))
                     THEN 1 ELSE 0 END)::int AS alloc
        FROM ranked r
    )
    UPDATE public.order_items oi
       SET paid_allocation_fils = computed.alloc
      FROM computed
     WHERE oi.id = computed.id;
  END IF;

  SELECT COALESCE(SUM(paid_allocation_fils),0) INTO v_alloc_sum
    FROM public.order_items WHERE order_id = v_order.id;
  IF v_alloc_sum <> v_settled_paid_fils THEN
    RAISE EXCEPTION 'paid_allocation_invariant_violation:%<>%',
      v_alloc_sum, v_settled_paid_fils USING ERRCODE='22023';
  END IF;

  FOR v_item IN
    SELECT oi.*, p.product_type, p.resource_id AS product_resource_id
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = v_order.id
  LOOP
    IF v_item.product_type = 'individual'::public.v2_product_type THEN
      IF v_item.resource_id IS NULL THEN
        RAISE EXCEPTION 'individual_missing_resource' USING ERRCODE='22023';
      END IF;
      INSERT INTO public.entitlements (user_id, resource_id, grant_reason, order_id,
                                       scope, version_major, source_order_item_id)
      VALUES (v_order.user_id, v_item.resource_id, 'purchase'::public.v2_grant_reason,
              v_order.id, 'resource'::public.v2_entitlement_scope,
              v_item.acquired_major_version, v_item.id)
      ON CONFLICT DO NOTHING;

    ELSIF v_item.product_type = 'bundle'::public.v2_product_type THEN
      IF v_item.product_resource_id IS NOT NULL THEN
        SELECT rv.major_version INTO v_major
          FROM public.resources r
          LEFT JOIN public.resource_versions rv ON rv.id = r.current_version_id
         WHERE r.id = v_item.product_resource_id;
        INSERT INTO public.entitlements (user_id, resource_id, grant_reason, order_id,
                                         scope, version_major, source_order_item_id)
        VALUES (v_order.user_id, v_item.product_resource_id,
                'purchase'::public.v2_grant_reason, v_order.id,
                'resource'::public.v2_entitlement_scope, v_major, v_item.id)
        ON CONFLICT DO NOTHING;
      END IF;

      FOR v_bi IN
        SELECT pbi.resource_id, rv.major_version
          FROM public.product_bundle_items pbi
          JOIN public.resources r ON r.id = pbi.resource_id
          LEFT JOIN public.resource_versions rv ON rv.id = r.current_version_id
         WHERE pbi.bundle_product_id = v_item.product_id
      LOOP
        INSERT INTO public.entitlements (user_id, resource_id, grant_reason, order_id,
                                         scope, version_major, source_order_item_id)
        VALUES (v_order.user_id, v_bi.resource_id,
                'purchase'::public.v2_grant_reason, v_order.id,
                'resource'::public.v2_entitlement_scope, v_bi.major_version, v_item.id)
        ON CONFLICT DO NOTHING;
      END LOOP;

    ELSIF v_item.product_type = 'lifetime'::public.v2_product_type THEN
      INSERT INTO public.entitlements (user_id, resource_id, grant_reason, order_id,
                                       scope, version_major, source_order_item_id)
      VALUES (v_order.user_id, NULL, 'lifetime_purchase'::public.v2_grant_reason,
              v_order.id, 'library'::public.v2_entitlement_scope, NULL, v_item.id)
      ON CONFLICT DO NOTHING;
      v_granted_lifetime_purchase := true;
    END IF;
  END LOOP;

  IF v_settled_paid_fils > 0 THEN
    INSERT INTO public.lifetime_credit_entries (user_id, order_id, refund_id, amount_fils, reason)
    VALUES (v_order.user_id, v_order.id, NULL, v_settled_paid_fils, 'purchase_settled')
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.v2_discount_redemptions
     SET status = 'consumed', consumed_at = now(), updated_at = now()
   WHERE order_id = v_order.id AND status = 'reserved';

  IF NOT v_granted_lifetime_purchase THEN
    SELECT COALESCE(SUM(amount_fils),0) INTO v_credit_after
      FROM public.lifetime_credit_entries WHERE user_id = v_order.user_id;
    IF v_credit_after >= 30000 THEN
      INSERT INTO public.entitlements (user_id, resource_id, grant_reason, order_id,
                                       scope, version_major, source_order_item_id)
      VALUES (v_order.user_id, NULL, 'lifetime_threshold'::public.v2_grant_reason,
              v_order.id, 'library'::public.v2_entitlement_scope, NULL, NULL)
      ON CONFLICT DO NOTHING;
      v_granted_lifetime_threshold := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'order_id', v_order.id, 'paid_fils', v_settled_paid_fils,
    'lifetime_purchase_granted', v_granted_lifetime_purchase,
    'lifetime_threshold_granted', v_granted_lifetime_threshold
  );
END $function$;

REVOKE ALL ON FUNCTION public.v2_apply_paid_order_locked(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
