
-- =========================================================================
-- V2 Commerce Phase 2B: paid allocation, entitlement provenance, refunds.
-- Additive; safe because V2 tables have no customer data yet.
-- =========================================================================

-- A1) order_items.paid_allocation_fils
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS paid_allocation_fils integer NOT NULL DEFAULT 0
    CHECK (paid_allocation_fils >= 0);

-- A2) entitlements.source_order_item_id
ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS source_order_item_id uuid
    REFERENCES public.order_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS entitlements_source_order_item_idx
  ON public.entitlements(source_order_item_id)
  WHERE source_order_item_id IS NOT NULL;

-- A3) Drop per-user permanent uniqueness. Keep per-order uniqueness so
-- separate purchases keep distinct provenance while duplicate settlement of
-- the same order is still blocked.
DROP INDEX IF EXISTS public.entitlements_one_permanent_per_user_resource;
DROP INDEX IF EXISTS public.entitlements_one_permanent_library_per_user;

-- Add per-order-item unique index for source-item-tied entitlements so
-- duplicate settlement in the same order can't produce two rows per item.
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_active_per_order_item_uidx
  ON public.entitlements(source_order_item_id, COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE revoked_at IS NULL AND source_order_item_id IS NOT NULL;

-- B1) Refund idempotency + optional sanitized provider payload
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS sanitized_provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS refunds_idempotency_key_uidx
  ON public.refunds(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Reinforce table-level SELECT lockdown on refunds: keep raw payload unreachable.
REVOKE SELECT ON public.refunds FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refunds TO service_role;

-- =========================================================================
-- A4) Replace v2_apply_paid_order_locked with allocation + provenance
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_apply_paid_order_locked(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_order    record;
  v_item     record;
  v_bi       record;
  v_major int;
  v_settled_paid_fils int;
  v_sum_line int;
  v_alloc_sum int := 0;
  v_remainder int;
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

  v_settled_paid_fils := v_order.total_fils;

  UPDATE public.orders
     SET status      = 'paid'::public.v2_order_status,
         paid_fils   = v_settled_paid_fils,
         placed_at   = COALESCE(v_order.placed_at, now()),
         settled_at  = now(),
         updated_at  = now()
   WHERE id = v_order.id;

  -- Deterministic largest-remainder allocation across order_items.
  SELECT COALESCE(SUM(line_total_fils),0) INTO v_sum_line
    FROM public.order_items WHERE order_id = v_order.id;

  IF v_sum_line = 0 THEN
    -- Distribute evenly across items by deterministic id order if line totals are zero.
    -- Degenerate case; ensures invariant sum(alloc)=paid_fils.
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
    -- Floor allocation, then distribute leftover fils by descending fractional remainder,
    -- ties broken by ascending order_item.id for determinism.
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

  -- Verify invariant
  SELECT COALESCE(SUM(paid_allocation_fils),0) INTO v_alloc_sum
    FROM public.order_items WHERE order_id = v_order.id;
  IF v_alloc_sum <> v_settled_paid_fils THEN
    RAISE EXCEPTION 'paid_allocation_invariant_violation:%<>%',
      v_alloc_sum, v_settled_paid_fils USING ERRCODE='22023';
  END IF;

  -- Grants tied to source_order_item_id
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
END $$;
REVOKE ALL ON FUNCTION public.v2_apply_paid_order_locked(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- =========================================================================
-- A5) v2_create_checkout_order: reject overlapping resource products
-- (Preserve existing behavior otherwise; add the overlap detector after
-- product locking.)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_create_checkout_order(
  p_actor_user_id uuid,
  p_product_ids uuid[],
  p_idempotency_key text,
  p_discount_code text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
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
  v_bundle_owned_count int;
  v_bundle_total int;
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
    IF v_product.product_type = 'lifetime'::public.v2_product_type THEN
      v_has_lifetime := true;
      v_lifetime_price := v_product.price_fils;
    ELSE
      v_has_non_lifetime := true;
      v_subtotal := v_subtotal + v_product.price_fils;
    END IF;

    IF v_product.product_type = 'individual'::public.v2_product_type
       AND v_product.resource_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.entitlements
                  WHERE user_id = p_actor_user_id
                    AND resource_id = v_product.resource_id
                    AND scope = 'resource'::public.v2_entitlement_scope
                    AND revoked_at IS NULL
                    AND (expires_at IS NULL OR expires_at > now())) THEN
        v_already_owned := array_append(v_already_owned, v_product.resource_id);
      END IF;
    ELSIF v_product.product_type = 'bundle'::public.v2_product_type THEN
      SELECT count(*) INTO v_bundle_total FROM public.product_bundle_items WHERE bundle_product_id = v_product.id;
      IF v_bundle_total > 0 THEN
        SELECT count(*) INTO v_bundle_owned_count
          FROM public.product_bundle_items pbi
          JOIN public.entitlements e
            ON e.user_id = p_actor_user_id AND e.resource_id = pbi.resource_id
           AND e.scope = 'resource'::public.v2_entitlement_scope
           AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now())
         WHERE pbi.bundle_product_id = v_product.id;
        IF v_bundle_owned_count = v_bundle_total THEN
          v_already_owned := array_append(v_already_owned, v_product.id);
        END IF;
      END IF;
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

  -- Overlap detection across products in the cart.
  -- Expand each product to its set of covered resource_ids.
  WITH cart AS (
    SELECT p.id AS product_id, p.product_type, p.resource_id AS root
      FROM public.products p WHERE p.id = ANY(v_dedup)
  ),
  expanded AS (
    SELECT product_id, root AS resource_id FROM cart
      WHERE root IS NOT NULL
    UNION ALL
    SELECT c.product_id, pbi.resource_id
      FROM cart c JOIN public.product_bundle_items pbi
        ON pbi.bundle_product_id = c.product_id
      WHERE c.product_type = 'bundle'::public.v2_product_type
  ),
  dupes AS (
    SELECT resource_id, array_agg(DISTINCT product_id) AS products
      FROM expanded
      GROUP BY resource_id
     HAVING count(DISTINCT product_id) > 1
  )
  SELECT COALESCE(array_agg(DISTINCT p), '{}')
    INTO v_overlap
    FROM dupes, LATERAL unnest(products) AS p;

  IF array_length(v_overlap,1) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'overlapping_resource_products',
      'product_ids', to_jsonb(v_overlap));
  END IF;

  IF array_length(v_already_owned,1) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_owned',
      'already_owned_resource_ids', to_jsonb(v_already_owned));
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

  INSERT INTO public.payment_events (order_id, provider, external_event_id, event_type,
                                     amount_fils, currency, raw_payload, received_at)
  VALUES (v_order_id, v_provider, 'local:created:' || v_order_id::text,
          'created'::public.v2_payment_event_type, v_total, 'KWD',
          jsonb_build_object('kind','created','order_id',v_order_id,'attempt_id',v_attempt_id),
          now());

  IF v_total = 0 THEN
    INSERT INTO public.payment_events (order_id, provider, external_event_id, event_type,
                                       amount_fils, currency, raw_payload, received_at)
    VALUES (v_order_id, 'internal', 'local:captured:' || v_order_id::text,
            'captured'::public.v2_payment_event_type, 0, 'KWD',
            jsonb_build_object('kind','zero_total_internal','order_id',v_order_id),
            now());
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
END $$;

-- =========================================================================
-- B2) v2_create_refund_request
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_create_refund_request(
  p_admin_actor_id uuid,
  p_order_id uuid,
  p_idempotency_key text,
  p_allocations jsonb,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_existing record;
  v_alloc record;
  v_item record;
  v_total_new int := 0;
  v_alloc_count int := 0;
  v_refund_id uuid;
  v_attempt record;
  v_processed_prior int;
  v_pending_prior int;
  v_item_prior int;
  v_pos int := 0;
  v_dup_check jsonb;
BEGIN
  IF p_admin_actor_id IS NULL OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key)='' OR char_length(p_idempotency_key)>120 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE='22023';
  END IF;
  IF p_allocations IS NULL OR jsonb_typeof(p_allocations) <> 'array'
     OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'invalid_allocations' USING ERRCODE='22023';
  END IF;
  IF COALESCE(char_length(p_reason),0) > 512 THEN
    RAISE EXCEPTION 'reason_too_long' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('v2refund:'||p_idempotency_key,0));

  SELECT * INTO v_existing FROM public.refunds
    WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF v_existing.order_id <> p_order_id THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='23505';
    END IF;
    RETURN jsonb_build_object('ok', true, 'idempotent_replay', true,
      'refund_id', v_existing.id, 'status', v_existing.status::text,
      'amount_fils', v_existing.amount_fils);
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;
  IF v_order.status NOT IN ('paid'::public.v2_order_status,
                            'partially_refunded'::public.v2_order_status) THEN
    RAISE EXCEPTION 'order_not_refundable' USING ERRCODE='22023';
  END IF;
  IF v_order.provider IS DISTINCT FROM 'upayments' THEN
    RAISE EXCEPTION 'order_provider_not_upayments' USING ERRCODE='22023';
  END IF;
  IF v_order.paid_fils <= 0 THEN
    RAISE EXCEPTION 'order_not_settled' USING ERRCODE='22023';
  END IF;

  -- Bound uniqueness of item ids in payload
  SELECT jsonb_agg(DISTINCT (a->>'order_item_id')) INTO v_dup_check FROM jsonb_array_elements(p_allocations) a;
  IF jsonb_array_length(v_dup_check) <> jsonb_array_length(p_allocations) THEN
    RAISE EXCEPTION 'duplicate_allocation_item' USING ERRCODE='22023';
  END IF;

  -- Iterate allocations, validate, sum
  FOR v_alloc IN
    SELECT (a->>'order_item_id')::uuid AS order_item_id,
           (a->>'amount_fils')::int AS amount_fils
      FROM jsonb_array_elements(p_allocations) a
  LOOP
    v_alloc_count := v_alloc_count + 1;
    IF v_alloc.amount_fils IS NULL OR v_alloc.amount_fils <= 0 THEN
      RAISE EXCEPTION 'invalid_allocation_amount' USING ERRCODE='22023';
    END IF;
    SELECT * INTO v_item FROM public.order_items
      WHERE id = v_alloc.order_item_id AND order_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'order_item_not_in_order' USING ERRCODE='22023';
    END IF;

    -- Sum prior non-terminal allocations for this item (pending/approved/processed)
    SELECT COALESCE(SUM(ri.amount_fils),0)
      INTO v_item_prior
      FROM public.refund_items ri JOIN public.refunds r ON r.id = ri.refund_id
     WHERE ri.order_item_id = v_alloc.order_item_id
       AND r.status IN ('pending'::public.v2_refund_status,
                        'approved'::public.v2_refund_status,
                        'processed'::public.v2_refund_status);
    IF v_item_prior + v_alloc.amount_fils > v_item.paid_allocation_fils THEN
      RAISE EXCEPTION 'allocation_exceeds_item_paid:%', v_alloc.order_item_id USING ERRCODE='22023';
    END IF;
    v_total_new := v_total_new + v_alloc.amount_fils;
  END LOOP;

  -- Total ceiling vs order.paid_fils - existing non-terminal refunds
  SELECT COALESCE(SUM(amount_fils),0) INTO v_pending_prior
    FROM public.refunds WHERE order_id = p_order_id
     AND status IN ('pending'::public.v2_refund_status,
                    'approved'::public.v2_refund_status,
                    'processed'::public.v2_refund_status);
  IF v_pending_prior + v_total_new > v_order.paid_fils THEN
    RAISE EXCEPTION 'allocation_exceeds_order_paid' USING ERRCODE='22023';
  END IF;

  v_refund_id := gen_random_uuid();
  INSERT INTO public.refunds (id, order_id, user_id, amount_fils, reason, status,
                              requested_at, idempotency_key)
  VALUES (v_refund_id, p_order_id, v_order.user_id, v_total_new,
          NULLIF(p_reason,''), 'pending'::public.v2_refund_status, now(), p_idempotency_key);

  INSERT INTO public.refund_items (refund_id, order_item_id, amount_fils)
  SELECT v_refund_id, (a->>'order_item_id')::uuid, (a->>'amount_fils')::int
    FROM jsonb_array_elements(p_allocations) a;

  -- Return provider info for submission (from latest verified attempt)
  SELECT pa.* INTO v_attempt FROM public.payment_attempts pa
   WHERE pa.order_id = p_order_id AND pa.provider = 'upayments'
     AND pa.status = 'verified_paid'
   ORDER BY pa.updated_at DESC NULLS LAST, pa.created_at DESC LIMIT 1;

  IF v_attempt.id IS NULL OR v_attempt.provider_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'refund_id', v_refund_id,
      'status', 'pending', 'amount_fils', v_total_new,
      'recovery_required', true);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'refund_id', v_refund_id, 'status', 'pending',
    'amount_fils', v_total_new,
    'provider', 'upayments',
    'provider_order_id', v_attempt.provider_order_id,
    'amount_kwd_decimal', round(v_total_new::numeric/1000, 3)::text
  );
END $$;
REVOKE ALL ON FUNCTION public.v2_create_refund_request(uuid,uuid,text,jsonb,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_create_refund_request(uuid,uuid,text,jsonb,text) TO service_role;

-- =========================================================================
-- B3) v2_record_upayments_refund_response
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_record_upayments_refund_response(
  p_admin_actor_id uuid,
  p_refund_id uuid,
  p_provider_refund_order_id text,
  p_external_event_id text,
  p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_refund record;
BEGIN
  IF p_admin_actor_id IS NULL OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;
  IF p_provider_refund_order_id IS NULL OR char_length(p_provider_refund_order_id) > 128
     OR btrim(p_provider_refund_order_id) = '' THEN
    RAISE EXCEPTION 'invalid_provider_refund_order_id' USING ERRCODE='22023';
  END IF;
  IF p_external_event_id IS NULL OR btrim(p_external_event_id)=''
     OR char_length(p_external_event_id) > 256 THEN
    RAISE EXCEPTION 'invalid_external_event_id' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;

  -- Idempotency: if already approved with same provider id, replay.
  IF v_refund.status = 'approved'::public.v2_refund_status
     AND v_refund.provider_refund_order_id = p_provider_refund_order_id THEN
    RETURN jsonb_build_object('ok', true, 'idempotent_replay', true,
      'refund_id', v_refund.id, 'status', 'approved');
  END IF;

  IF v_refund.status <> 'pending'::public.v2_refund_status THEN
    RAISE EXCEPTION 'refund_not_pending' USING ERRCODE='22023';
  END IF;

  UPDATE public.refunds
     SET status = 'approved'::public.v2_refund_status,
         provider_refund_order_id = p_provider_refund_order_id,
         sanitized_provider_payload = COALESCE(p_sanitized_payload, sanitized_provider_payload),
         last_checked_at = now(),
         updated_at = now()
   WHERE id = p_refund_id;

  INSERT INTO public.payment_events (order_id, provider, external_event_id, event_type,
                                     amount_fils, currency, raw_payload, received_at)
  VALUES (v_refund.order_id, 'upayments', p_external_event_id,
          'authorized'::public.v2_payment_event_type,
          v_refund.amount_fils, 'KWD',
          COALESCE(p_sanitized_payload,'{}'::jsonb), now())
  ON CONFLICT (provider, external_event_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id, 'status', 'approved');
END $$;
REVOKE ALL ON FUNCTION public.v2_record_upayments_refund_response(uuid,uuid,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_record_upayments_refund_response(uuid,uuid,text,text,jsonb) TO service_role;

-- =========================================================================
-- B4) v2_apply_verified_refund
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_apply_verified_refund(
  p_admin_actor_id uuid,
  p_refund_id uuid,
  p_provider_refund_order_id text,
  p_result text,
  p_external_event_id text,
  p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_refund record;
  v_order record;
  v_result_norm text := upper(COALESCE(p_result,''));
  v_event_inserted int := 0;
  v_ri record;
  v_total_processed_item int;
  v_net_credit int;
  v_processed_total int;
  v_new_order_status public.v2_order_status;
BEGIN
  IF p_admin_actor_id IS NULL OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;
  IF v_result_norm NOT IN ('REFUNDED','PROCESSED','SUCCESS') THEN
    RAISE EXCEPTION 'result_not_allowlisted' USING ERRCODE='22023';
  END IF;
  IF p_external_event_id IS NULL OR btrim(p_external_event_id)=''
     OR char_length(p_external_event_id) > 256 THEN
    RAISE EXCEPTION 'invalid_external_event_id' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;
  IF v_refund.provider_refund_order_id IS DISTINCT FROM p_provider_refund_order_id THEN
    RAISE EXCEPTION 'provider_refund_order_id_mismatch' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_refund.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;

  -- Immutable event first (idempotency)
  INSERT INTO public.payment_events (order_id, provider, external_event_id, event_type,
                                     amount_fils, currency, raw_payload, received_at)
  VALUES (v_order.id, 'upayments', p_external_event_id,
          'refunded'::public.v2_payment_event_type,
          v_refund.amount_fils, 'KWD',
          COALESCE(p_sanitized_payload,'{}'::jsonb), now())
  ON CONFLICT (provider, external_event_id) DO NOTHING;
  GET DIAGNOSTICS v_event_inserted = ROW_COUNT;

  IF v_event_inserted = 0 THEN
    RETURN jsonb_build_object('ok', true, 'duplicate_event', true,
      'refund_id', v_refund.id, 'status', v_refund.status::text);
  END IF;

  IF v_refund.status = 'processed'::public.v2_refund_status THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true,
      'refund_id', v_refund.id);
  END IF;

  UPDATE public.refunds
     SET status = 'processed'::public.v2_refund_status,
         processed_at = now(),
         last_checked_at = now(),
         sanitized_provider_payload = COALESCE(p_sanitized_payload, sanitized_provider_payload),
         updated_at = now()
   WHERE id = p_refund_id;

  -- Single negative credit entry keyed by refund id.
  INSERT INTO public.lifetime_credit_entries (user_id, order_id, refund_id, amount_fils, reason)
  VALUES (v_order.user_id, NULL, v_refund.id, -v_refund.amount_fils, 'refund_processed')
  ON CONFLICT DO NOTHING;

  -- Revoke entitlements when an item is fully refunded across all processed refunds.
  FOR v_ri IN
    SELECT order_item_id FROM public.refund_items WHERE refund_id = v_refund.id
  LOOP
    SELECT COALESCE(SUM(ri.amount_fils),0) INTO v_total_processed_item
      FROM public.refund_items ri JOIN public.refunds r ON r.id = ri.refund_id
     WHERE ri.order_item_id = v_ri.order_item_id
       AND r.status = 'processed'::public.v2_refund_status;

    UPDATE public.entitlements e
       SET revoked_at = now(),
           revoke_reason = 'refunded_order_item',
           updated_at = now()
      FROM public.order_items oi
     WHERE e.source_order_item_id = v_ri.order_item_id
       AND e.revoked_at IS NULL
       AND oi.id = v_ri.order_item_id
       AND v_total_processed_item >= oi.paid_allocation_fils;
  END LOOP;

  -- Recalculate net credit; if below threshold, revoke lifetime_threshold grants only.
  SELECT COALESCE(SUM(amount_fils),0) INTO v_net_credit
    FROM public.lifetime_credit_entries WHERE user_id = v_order.user_id;
  IF v_net_credit < 30000 THEN
    UPDATE public.entitlements
       SET revoked_at = now(),
           revoke_reason = 'lifetime_credit_below_threshold',
           updated_at = now()
     WHERE user_id = v_order.user_id
       AND scope = 'library'::public.v2_entitlement_scope
       AND grant_reason = 'lifetime_threshold'::public.v2_grant_reason
       AND revoked_at IS NULL;
  END IF;

  -- Order status: refunded vs partially_refunded based on processed sum.
  SELECT COALESCE(SUM(amount_fils),0) INTO v_processed_total
    FROM public.refunds
   WHERE order_id = v_order.id AND status = 'processed'::public.v2_refund_status;
  v_new_order_status := CASE WHEN v_processed_total >= v_order.paid_fils
                             THEN 'refunded'::public.v2_order_status
                             ELSE 'partially_refunded'::public.v2_order_status END;
  UPDATE public.orders SET status = v_new_order_status, updated_at = now()
   WHERE id = v_order.id;

  RETURN jsonb_build_object('ok', true, 'refund_id', v_refund.id,
    'status', 'processed', 'order_status', v_new_order_status::text,
    'processed_total_fils', v_processed_total);
END $$;
REVOKE ALL ON FUNCTION public.v2_apply_verified_refund(uuid,uuid,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_apply_verified_refund(uuid,uuid,text,text,text,jsonb) TO service_role;

-- =========================================================================
-- B5) v2_mark_verified_refund_failure
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_mark_verified_refund_failure(
  p_admin_actor_id uuid,
  p_refund_id uuid,
  p_provider_refund_order_id text,
  p_result text,
  p_external_event_id text,
  p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_refund record;
BEGIN
  IF p_admin_actor_id IS NULL OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;
  IF p_result IS NULL OR btrim(p_result)='' OR char_length(p_result)>64 THEN
    RAISE EXCEPTION 'invalid_result' USING ERRCODE='22023';
  END IF;
  IF p_external_event_id IS NULL OR btrim(p_external_event_id)=''
     OR char_length(p_external_event_id) > 256 THEN
    RAISE EXCEPTION 'invalid_external_event_id' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;

  IF v_refund.provider_refund_order_id IS NOT NULL
     AND p_provider_refund_order_id IS NOT NULL
     AND v_refund.provider_refund_order_id <> p_provider_refund_order_id THEN
    RAISE EXCEPTION 'provider_refund_order_id_mismatch' USING ERRCODE='22023';
  END IF;

  -- Do not override terminal processed state.
  IF v_refund.status = 'processed'::public.v2_refund_status THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'refund_id', v_refund.id,
      'status', 'processed');
  END IF;

  INSERT INTO public.payment_events (order_id, provider, external_event_id, event_type,
                                     amount_fils, currency, raw_payload, received_at)
  VALUES (v_refund.order_id, 'upayments', p_external_event_id,
          'failed'::public.v2_payment_event_type,
          v_refund.amount_fils, 'KWD',
          COALESCE(p_sanitized_payload,'{}'::jsonb), now())
  ON CONFLICT (provider, external_event_id) DO NOTHING;

  UPDATE public.refunds
     SET status = 'failed'::public.v2_refund_status,
         last_checked_at = now(),
         sanitized_provider_payload = COALESCE(p_sanitized_payload, sanitized_provider_payload),
         updated_at = now()
   WHERE id = p_refund_id;

  RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id, 'status', 'failed');
END $$;
REVOKE ALL ON FUNCTION public.v2_mark_verified_refund_failure(uuid,uuid,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_mark_verified_refund_failure(uuid,uuid,text,text,text,jsonb) TO service_role;

-- =========================================================================
-- B6) Safe reads
-- =========================================================================

-- Customer refund state
CREATE OR REPLACE FUNCTION public.v2_refund_state(p_refund_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_refund record;
  v_items jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE='42501'; END IF;
  SELECT r.* INTO v_refund FROM public.refunds r
   WHERE r.id = p_refund_id AND r.user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;

  SELECT jsonb_agg(jsonb_build_object(
      'order_item_id', ri.order_item_id,
      'amount_fils', ri.amount_fils))
    INTO v_items
    FROM public.refund_items ri WHERE ri.refund_id = v_refund.id;

  RETURN jsonb_build_object(
    'id', v_refund.id,
    'order_id', v_refund.order_id,
    'status', v_refund.status,
    'amount_fils', v_refund.amount_fils,
    'currency', 'KWD',
    'provider_refund_order_id', v_refund.provider_refund_order_id,
    'requested_at', v_refund.requested_at,
    'processed_at', v_refund.processed_at,
    'allocations', COALESCE(v_items,'[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.v2_refund_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_refund_state(uuid) TO authenticated;

-- Admin refund list
CREATE OR REPLACE FUNCTION public.v2_admin_list_refunds(
  p_status text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_rows jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN p_limit := 50; END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN p_offset := 0; END IF;

  SELECT jsonb_agg(row_to_json(x)) INTO v_rows FROM (
    SELECT r.id, r.order_id, r.user_id, r.status, r.amount_fils, r.currency,
           r.provider_refund_order_id,
           r.requested_at, r.processed_at, r.last_checked_at,
           r.idempotency_key,
           octet_length(COALESCE(r.sanitized_provider_payload::text,'')) AS payload_bytes,
           (SELECT COALESCE(SUM(ri.amount_fils),0)
              FROM public.refund_items ri WHERE ri.refund_id = r.id) AS allocations_total,
           (SELECT jsonb_agg(jsonb_build_object('order_item_id', ri.order_item_id,
                                                'amount_fils', ri.amount_fils))
              FROM public.refund_items ri WHERE ri.refund_id = r.id) AS allocations
      FROM public.refunds r
     WHERE (p_status IS NULL OR r.status::text = p_status)
       AND (p_order_id IS NULL OR r.order_id = p_order_id)
     ORDER BY r.requested_at DESC
     LIMIT p_limit OFFSET p_offset
  ) x;

  RETURN jsonb_build_object('rows', COALESCE(v_rows,'[]'::jsonb),
    'limit', p_limit, 'offset', p_offset);
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_list_refunds(text,uuid,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_refunds(text,uuid,int,int) TO authenticated;

-- Extended reconciliation summary
CREATE OR REPLACE FUNCTION public.v2_admin_reconciliation_summary()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_mismatches int;
  v_pending_past_due int;
  v_paid_without_entitlement int;
  v_credit_inconsistent int;
  v_duplicate_event_risk int;
  v_alloc_over_item int;
  v_alloc_over_order int;
  v_processed_missing_credit int;
  v_processed_item_unrevoked int;
  v_threshold_below_credit int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_mismatches FROM public.payment_attempts WHERE status = 'mismatch';
  SELECT count(*) INTO v_pending_past_due FROM public.payment_attempts
    WHERE status IN ('pending','redirect_ready','created')
      AND created_at < now() - interval '2 hours';
  SELECT count(*) INTO v_paid_without_entitlement
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.products p ON p.id = oi.product_id
   WHERE o.status = 'paid'::public.v2_order_status
     AND p.product_type IN ('individual'::public.v2_product_type,'lifetime'::public.v2_product_type)
     AND NOT EXISTS (
       SELECT 1 FROM public.entitlements e
        WHERE e.order_id = o.id AND e.revoked_at IS NULL
     );
  SELECT count(*) INTO v_credit_inconsistent
    FROM public.orders o
   WHERE o.status = 'paid'::public.v2_order_status
     AND o.paid_fils > 0
     AND NOT EXISTS (SELECT 1 FROM public.lifetime_credit_entries l
                      WHERE l.order_id = o.id AND l.amount_fils > 0);
  SELECT COALESCE(sum(c-1),0) INTO v_duplicate_event_risk FROM (
    SELECT count(*) AS c FROM public.payment_events
     GROUP BY provider, external_event_id HAVING count(*) > 1
  ) d;

  -- Refund allocations exceeding item paid allocation
  SELECT count(*) INTO v_alloc_over_item FROM (
    SELECT ri.order_item_id, SUM(ri.amount_fils) AS s, MAX(oi.paid_allocation_fils) AS cap
      FROM public.refund_items ri
      JOIN public.refunds r ON r.id = ri.refund_id
      JOIN public.order_items oi ON oi.id = ri.order_item_id
     WHERE r.status IN ('pending'::public.v2_refund_status,
                        'approved'::public.v2_refund_status,
                        'processed'::public.v2_refund_status)
     GROUP BY ri.order_item_id
    HAVING SUM(ri.amount_fils) > MAX(oi.paid_allocation_fils)
  ) x;

  -- Refund total over order paid_fils
  SELECT count(*) INTO v_alloc_over_order FROM (
    SELECT r.order_id, SUM(r.amount_fils) AS s, MAX(o.paid_fils) AS cap
      FROM public.refunds r JOIN public.orders o ON o.id = r.order_id
     WHERE r.status IN ('pending'::public.v2_refund_status,
                        'approved'::public.v2_refund_status,
                        'processed'::public.v2_refund_status)
     GROUP BY r.order_id
    HAVING SUM(r.amount_fils) > MAX(o.paid_fils)
  ) x;

  -- Processed refunds missing negative credit entry
  SELECT count(*) INTO v_processed_missing_credit
    FROM public.refunds r
   WHERE r.status = 'processed'::public.v2_refund_status
     AND NOT EXISTS (SELECT 1 FROM public.lifetime_credit_entries l
                      WHERE l.refund_id = r.id AND l.amount_fils < 0);

  -- Fully-processed items whose source entitlements are still active
  SELECT count(*) INTO v_processed_item_unrevoked FROM (
    SELECT ri.order_item_id
      FROM public.refund_items ri
      JOIN public.refunds r ON r.id = ri.refund_id
      JOIN public.order_items oi ON oi.id = ri.order_item_id
     WHERE r.status = 'processed'::public.v2_refund_status
     GROUP BY ri.order_item_id, oi.paid_allocation_fils
    HAVING SUM(ri.amount_fils) >= oi.paid_allocation_fils
       AND EXISTS (SELECT 1 FROM public.entitlements e
                    WHERE e.source_order_item_id = ri.order_item_id
                      AND e.revoked_at IS NULL)
  ) x;

  -- Threshold lifetime still active while net credit < 30000
  SELECT count(*) INTO v_threshold_below_credit FROM public.entitlements e
   WHERE e.grant_reason = 'lifetime_threshold'::public.v2_grant_reason
     AND e.revoked_at IS NULL
     AND (SELECT COALESCE(SUM(amount_fils),0) FROM public.lifetime_credit_entries l
           WHERE l.user_id = e.user_id) < 30000;

  RETURN jsonb_build_object(
    'mismatches', v_mismatches,
    'pending_past_due', v_pending_past_due,
    'paid_without_entitlement', v_paid_without_entitlement,
    'credit_inconsistent', v_credit_inconsistent,
    'duplicate_event_risk', v_duplicate_event_risk,
    'refund_alloc_over_item', v_alloc_over_item,
    'refund_alloc_over_order', v_alloc_over_order,
    'processed_missing_credit', v_processed_missing_credit,
    'processed_item_unrevoked_entitlement', v_processed_item_unrevoked,
    'threshold_lifetime_below_credit', v_threshold_below_credit,
    'as_of', now()
  );
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_reconciliation_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_admin_reconciliation_summary() TO authenticated;
