
-- =====================================================================
-- V2 Commerce Phase 2B corrective migration
-- Canonical fixes for checkout ownership/overlap, settlement idempotency,
-- refund state guards, and trigger helper privileges.
-- =====================================================================

-- (3) Partial unique index: at most one active library entitlement per
-- (user_id, grant_reason) for lifetime_purchase and lifetime_threshold.
-- Revoked rows remain historical.
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_one_active_lifetime_per_user_reason_uidx
  ON public.entitlements (user_id, grant_reason)
  WHERE revoked_at IS NULL
    AND scope = 'library'::public.v2_entitlement_scope
    AND grant_reason IN ('lifetime_purchase'::public.v2_grant_reason,
                         'lifetime_threshold'::public.v2_grant_reason);

-- =====================================================================
-- (4) Internal helper: insert a payment_event or verify idempotent match.
-- On (provider, external_event_id) conflict we require order_id,
-- event_type, amount_fils, currency to match exactly; otherwise raise
-- external_event_conflict. Returns true when a new row was inserted,
-- false when it is an exact idempotent replay.
-- Service-only helper: not exposed to any client role.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_insert_or_verify_payment_event(
  p_order_id uuid,
  p_provider text,
  p_external_event_id text,
  p_event_type public.v2_payment_event_type,
  p_amount_fils integer,
  p_currency text,
  p_raw jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_existing record;
  v_inserted int := 0;
BEGIN
  INSERT INTO public.payment_events (order_id, provider, external_event_id, event_type,
                                     amount_fils, currency, raw_payload, received_at)
  VALUES (p_order_id, p_provider, p_external_event_id, p_event_type,
          p_amount_fils, p_currency, COALESCE(p_raw,'{}'::jsonb), now())
  ON CONFLICT (provider, external_event_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 1 THEN RETURN true; END IF;

  SELECT order_id, event_type, amount_fils, currency
    INTO v_existing
    FROM public.payment_events
   WHERE provider = p_provider AND external_event_id = p_external_event_id;

  IF v_existing.order_id IS DISTINCT FROM p_order_id
     OR v_existing.event_type IS DISTINCT FROM p_event_type
     OR v_existing.amount_fils IS DISTINCT FROM p_amount_fils
     OR v_existing.currency IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION 'external_event_conflict' USING ERRCODE='23505';
  END IF;
  RETURN false;
END $fn$;

REVOKE ALL ON FUNCTION public.v2_insert_or_verify_payment_event(
  uuid, text, text, public.v2_payment_event_type, integer, text, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

-- =====================================================================
-- (1) + (2) v2_create_checkout_order
-- Per-user advisory lock, pending overlap guard (last 2h upayments),
-- per-resource ownership block (individual + bundle items),
-- price_fils <= 0 rejection for active non-free products.
-- =====================================================================
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

  -- Idempotency lock first, then per-user serialization for state checks.
  PERFORM pg_advisory_xact_lock(hashtextextended('v2checkout:'||p_idempotency_key, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('v2user:'||p_actor_user_id::text, 0));

  -- Idempotent replay on same key.
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

  -- Existing active lifetime blocks all purchases.
  SELECT EXISTS (
    SELECT 1 FROM public.entitlements
     WHERE user_id = p_actor_user_id
       AND scope = 'library'::public.v2_entitlement_scope
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_active_lifetime;
  IF v_active_lifetime THEN RAISE EXCEPTION 'already_lifetime' USING ERRCODE='22023'; END IF;

  -- Lock products, classify cart, reject invalid pricing.
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
    -- Reject active non-free products missing authoritative positive price.
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
  -- ANY covered resource already actively owned blocks the product.
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

  -- Overlap detection across products in the cart.
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
  -- Direct lifetime: block on any recent pending lifetime order.
  -- Non-lifetime: block only if resource coverage overlaps.
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
    pending_res AS (
      SELECT o.id AS order_id, o.order_number,
             COALESCE(p.resource_id, pbi.resource_id) AS resource_id
        FROM public.orders o
        JOIN public.order_items oi ON oi.order_id = o.id
        JOIN public.products p ON p.id = oi.product_id
        LEFT JOIN public.product_bundle_items pbi ON pbi.bundle_product_id = p.id
       WHERE o.user_id = p_actor_user_id
         AND o.status = 'pending'::public.v2_order_status
         AND o.provider = 'upayments'
         AND o.created_at > now() - interval '2 hours'
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

  -- Lifetime credit application.
  IF v_has_lifetime THEN
    SELECT COALESCE(SUM(amount_fils),0) INTO v_credit
      FROM public.lifetime_credit_entries WHERE user_id = p_actor_user_id;
    IF v_credit < 0 THEN v_credit := 0; END IF;
    IF v_credit > v_lifetime_price THEN v_credit := v_lifetime_price; END IF;
    v_lifetime_credit_applied := v_credit;
    v_subtotal := v_lifetime_price;
  END IF;

  -- Discount evaluation.
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

-- =====================================================================
-- (3) v2_apply_paid_order_locked: add user-scoped advisory lock to
-- serialize concurrent settlements and prevent duplicate active lifetime
-- threshold grants. Also handle unique-index conflict on lifetime rows
-- explicitly (harmless if already granted).
-- =====================================================================
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

  -- Per-user advisory lock to serialize concurrent settlements.
  PERFORM pg_advisory_xact_lock(hashtextextended('v2settle:'||v_order.user_id::text, 0));

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
      -- New per-(user,grant_reason) partial unique index prevents duplicate
      -- active lifetime_purchase across concurrent settlements.
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
      -- Partial unique index enforces at most one active lifetime_threshold per user.
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

-- Keep internal helper non-executable by any client role.
REVOKE ALL ON FUNCTION public.v2_apply_paid_order_locked(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- =====================================================================
-- (4) v2_record_upayments_charge_response with hardened event idempotency.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_record_upayments_charge_response(
  p_actor_user_id uuid, p_order_id uuid, p_attempt_id uuid, p_merchant_reference text,
  p_track_id text, p_session_id text, p_provider_order_id text, p_checkout_url text,
  p_sanitized_response jsonb, p_external_event_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order   record;
  v_attempt record;
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required' USING ERRCODE='22023'; END IF;
  IF p_external_event_id IS NULL OR btrim(p_external_event_id) = ''
     OR char_length(p_external_event_id) > 256 THEN
    RAISE EXCEPTION 'invalid_external_event_id' USING ERRCODE='22023';
  END IF;
  IF p_merchant_reference IS NULL OR char_length(p_merchant_reference) > 40 THEN
    RAISE EXCEPTION 'invalid_merchant_reference' USING ERRCODE='22023';
  END IF;
  IF p_checkout_url IS NULL OR p_checkout_url NOT LIKE 'https://%'
     OR char_length(p_checkout_url) > 2048 THEN
    RAISE EXCEPTION 'invalid_checkout_url' USING ERRCODE='22023';
  END IF;
  IF (p_track_id IS NULL OR btrim(p_track_id) = '')
     AND (p_session_id IS NULL OR btrim(p_session_id) = '') THEN
    RAISE EXCEPTION 'missing_provider_identifier' USING ERRCODE='22023';
  END IF;
  IF COALESCE(char_length(p_track_id),0) > 128
     OR COALESCE(char_length(p_session_id),0) > 128
     OR COALESCE(char_length(p_provider_order_id),0) > 128 THEN
    RAISE EXCEPTION 'identifier_too_long' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_response::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.user_id <> p_actor_user_id THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002';
  END IF;
  IF v_order.status <> 'pending'::public.v2_order_status THEN
    RAISE EXCEPTION 'order_not_pending' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_attempt FROM public.payment_attempts
    WHERE id = p_attempt_id AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found' USING ERRCODE='P0002'; END IF;
  IF v_attempt.provider <> 'upayments' THEN RAISE EXCEPTION 'attempt_wrong_provider' USING ERRCODE='22023'; END IF;
  IF v_attempt.merchant_reference <> p_merchant_reference THEN
    RAISE EXCEPTION 'merchant_reference_mismatch' USING ERRCODE='22023';
  END IF;

  UPDATE public.payment_attempts
     SET status = 'redirect_ready',
         track_id = COALESCE(p_track_id, track_id),
         session_id = COALESCE(p_session_id, session_id),
         provider_order_id = COALESCE(p_provider_order_id, provider_order_id),
         checkout_url = COALESCE(p_checkout_url, checkout_url),
         response_payload = COALESCE(p_sanitized_response, response_payload),
         updated_at = now()
   WHERE id = p_attempt_id;

  PERFORM public.v2_insert_or_verify_payment_event(
    p_order_id, 'upayments', p_external_event_id,
    'authorized'::public.v2_payment_event_type,
    v_attempt.expected_amount_fils, 'KWD',
    COALESCE(p_sanitized_response,'{}'::jsonb));

  RETURN jsonb_build_object('ok', true, 'attempt_id', p_attempt_id, 'status', 'redirect_ready');
END $function$;

-- =====================================================================
-- (4) v2_settle_verified_upayments_payment with hardened event idempotency.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_settle_verified_upayments_payment(
  p_actor_user_id uuid, p_order_id uuid, p_attempt_id uuid, p_merchant_reference text,
  p_track_id text, p_session_id text, p_provider_order_id text, p_amount_fils integer,
  p_currency text, p_result text, p_external_event_id text, p_sanitized_verified_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order record;
  v_attempt record;
  v_result_norm text := upper(COALESCE(p_result,''));
  v_new_event boolean;
  v_apply jsonb;
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required' USING ERRCODE='22023'; END IF;
  IF v_result_norm NOT IN ('CAPTURED','SUCCESS','PAID') THEN
    RAISE EXCEPTION 'result_not_allowlisted' USING ERRCODE='22023';
  END IF;
  IF p_currency IS DISTINCT FROM 'KWD' THEN RAISE EXCEPTION 'invalid_currency' USING ERRCODE='22023'; END IF;
  IF p_external_event_id IS NULL OR btrim(p_external_event_id) = ''
     OR char_length(p_external_event_id) > 256 THEN
    RAISE EXCEPTION 'invalid_external_event_id' USING ERRCODE='22023';
  END IF;
  IF p_merchant_reference IS NULL OR char_length(p_merchant_reference) > 40 THEN
    RAISE EXCEPTION 'invalid_merchant_reference' USING ERRCODE='22023';
  END IF;
  IF (p_track_id IS NULL OR btrim(p_track_id) = '')
     AND (p_session_id IS NULL OR btrim(p_session_id) = '') THEN
    RAISE EXCEPTION 'missing_provider_identifier' USING ERRCODE='22023';
  END IF;
  IF COALESCE(char_length(p_track_id),0) > 128
     OR COALESCE(char_length(p_session_id),0) > 128
     OR COALESCE(char_length(p_provider_order_id),0) > 128 THEN
    RAISE EXCEPTION 'identifier_too_long' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_verified_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;
  IF v_order.user_id <> p_actor_user_id THEN
    RAISE EXCEPTION 'actor_not_owner' USING ERRCODE='42501';
  END IF;
  IF v_order.status IN ('refunded'::public.v2_order_status,
                        'partially_refunded'::public.v2_order_status) THEN
    RAISE EXCEPTION 'order_not_settleable' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_attempt FROM public.payment_attempts
    WHERE id = p_attempt_id AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found' USING ERRCODE='P0002'; END IF;

  IF v_attempt.provider <> 'upayments' THEN RAISE EXCEPTION 'provider_mismatch' USING ERRCODE='22023'; END IF;
  IF v_attempt.merchant_reference <> p_merchant_reference THEN
    RAISE EXCEPTION 'merchant_reference_mismatch' USING ERRCODE='22023';
  END IF;
  IF p_amount_fils <> v_order.total_fils OR p_amount_fils <> v_attempt.expected_amount_fils THEN
    RAISE EXCEPTION 'amount_mismatch' USING ERRCODE='22023';
  END IF;
  IF p_track_id IS NOT NULL AND v_attempt.track_id IS NOT NULL AND v_attempt.track_id <> p_track_id THEN
    RAISE EXCEPTION 'track_id_mismatch' USING ERRCODE='22023';
  END IF;
  IF p_session_id IS NOT NULL AND v_attempt.session_id IS NOT NULL AND v_attempt.session_id <> p_session_id THEN
    RAISE EXCEPTION 'session_id_mismatch' USING ERRCODE='22023';
  END IF;
  IF p_provider_order_id IS NOT NULL AND v_attempt.provider_order_id IS NOT NULL
     AND v_attempt.provider_order_id <> p_provider_order_id THEN
    RAISE EXCEPTION 'provider_order_id_mismatch' USING ERRCODE='22023';
  END IF;

  -- Hardened event insert; raises external_event_conflict on mismatch.
  v_new_event := public.v2_insert_or_verify_payment_event(
    p_order_id, 'upayments', p_external_event_id,
    'captured'::public.v2_payment_event_type, p_amount_fils, 'KWD',
    COALESCE(p_sanitized_verified_payload,'{}'::jsonb));

  IF NOT v_new_event THEN
    RETURN jsonb_build_object('ok', true, 'duplicate_event', true,
      'order_id', p_order_id, 'status', v_order.status::text);
  END IF;

  UPDATE public.payment_attempts
     SET status = 'verified_paid',
         verified_payload = COALESCE(p_sanitized_verified_payload, verified_payload),
         track_id = COALESCE(p_track_id, track_id),
         session_id = COALESCE(p_session_id, session_id),
         provider_order_id = COALESCE(p_provider_order_id, provider_order_id),
         last_checked_at = now(),
         updated_at = now()
   WHERE id = p_attempt_id;

  UPDATE public.orders
     SET provider = 'upayments',
         provider_reference = COALESCE(NULLIF(p_provider_order_id,''), NULLIF(p_track_id,''), provider_reference),
         updated_at = now()
   WHERE id = p_order_id;

  v_apply := public.v2_apply_paid_order_locked(p_order_id);
  RETURN v_apply;
END $function$;

-- =====================================================================
-- (4) v2_mark_verified_payment_failure with hardened event idempotency.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_mark_verified_payment_failure(
  p_actor_user_id uuid, p_order_id uuid, p_attempt_id uuid, p_merchant_reference text,
  p_result text, p_external_event_id text, p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_order record;
  v_attempt record;
  v_result_norm text := upper(COALESCE(p_result,''));
  v_is_cancel boolean;
  v_new_attempt_status text;
  v_new_order_status public.v2_order_status;
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required' USING ERRCODE='22023'; END IF;
  IF p_result IS NULL OR btrim(p_result) = '' OR char_length(p_result) > 64 THEN
    RAISE EXCEPTION 'invalid_result' USING ERRCODE='22023';
  END IF;
  IF p_external_event_id IS NULL OR btrim(p_external_event_id) = ''
     OR char_length(p_external_event_id) > 256 THEN
    RAISE EXCEPTION 'invalid_external_event_id' USING ERRCODE='22023';
  END IF;
  IF p_merchant_reference IS NULL OR char_length(p_merchant_reference) > 40 THEN
    RAISE EXCEPTION 'invalid_merchant_reference' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;
  IF v_order.user_id <> p_actor_user_id THEN
    RAISE EXCEPTION 'actor_not_owner' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_attempt FROM public.payment_attempts
    WHERE id = p_attempt_id AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found' USING ERRCODE='P0002'; END IF;
  IF v_attempt.provider <> 'upayments' THEN
    RAISE EXCEPTION 'provider_mismatch' USING ERRCODE='22023';
  END IF;
  IF v_attempt.merchant_reference <> p_merchant_reference THEN
    RAISE EXCEPTION 'merchant_reference_mismatch' USING ERRCODE='22023';
  END IF;

  v_is_cancel := v_result_norm IN ('CANCELLED','CANCELED');

  -- Hardened idempotency: raises external_event_conflict on mismatch.
  PERFORM public.v2_insert_or_verify_payment_event(
    p_order_id, v_attempt.provider, p_external_event_id,
    'failed'::public.v2_payment_event_type,
    v_attempt.expected_amount_fils, 'KWD',
    COALESCE(p_sanitized_payload,'{}'::jsonb));

  v_new_attempt_status := CASE
    WHEN v_attempt.status = 'verified_paid' THEN v_attempt.status
    WHEN v_is_cancel THEN 'cancelled'
    ELSE 'failed'
  END;

  UPDATE public.payment_attempts
     SET status = v_new_attempt_status,
         verified_payload = COALESCE(p_sanitized_payload, verified_payload),
         last_checked_at = now(),
         updated_at = now()
   WHERE id = p_attempt_id;

  IF v_order.status NOT IN ('paid'::public.v2_order_status,
                            'refunded'::public.v2_order_status,
                            'partially_refunded'::public.v2_order_status) THEN
    v_new_order_status := CASE WHEN v_is_cancel THEN 'cancelled'::public.v2_order_status
                               ELSE 'failed'::public.v2_order_status END;
    UPDATE public.orders SET status = v_new_order_status, updated_at = now()
     WHERE id = p_order_id;
  END IF;

  UPDATE public.v2_discount_redemptions
     SET status = 'released', released_at = now(), updated_at = now()
   WHERE order_id = p_order_id AND status = 'reserved';

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id,
    'attempt_status', v_new_attempt_status);
END $function$;

-- =====================================================================
-- (5) v2_record_upayments_refund_response: pending -> approved only.
-- Replay verifies same refund/order/provider id and event semantics.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_record_upayments_refund_response(
  p_admin_actor_id uuid, p_refund_id uuid, p_provider_refund_order_id text,
  p_external_event_id text, p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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

  -- Idempotent replay only when status is approved with same provider ref.
  IF v_refund.status = 'approved'::public.v2_refund_status THEN
    IF v_refund.provider_refund_order_id IS DISTINCT FROM p_provider_refund_order_id THEN
      RAISE EXCEPTION 'provider_refund_order_id_mismatch' USING ERRCODE='22023';
    END IF;
    -- Verify event exists/matches; raises external_event_conflict on collision.
    PERFORM public.v2_insert_or_verify_payment_event(
      v_refund.order_id, 'upayments', p_external_event_id,
      'authorized'::public.v2_payment_event_type,
      v_refund.amount_fils, 'KWD',
      COALESCE(p_sanitized_payload,'{}'::jsonb));
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

  PERFORM public.v2_insert_or_verify_payment_event(
    v_refund.order_id, 'upayments', p_external_event_id,
    'authorized'::public.v2_payment_event_type,
    v_refund.amount_fils, 'KWD',
    COALESCE(p_sanitized_payload,'{}'::jsonb));

  RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id, 'status', 'approved');
END $function$;

-- =====================================================================
-- (6) v2_apply_verified_refund: require approved status (or processed
-- replay with exact match). Provider refund id must be non-null on both
-- sides and exactly equal. Event conflict check via helper. Processed
-- replay never creates a duplicate negative credit.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_apply_verified_refund(
  p_admin_actor_id uuid, p_refund_id uuid, p_provider_refund_order_id text,
  p_result text, p_external_event_id text, p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_refund record;
  v_order record;
  v_result_norm text := upper(COALESCE(p_result,''));
  v_new_event boolean;
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
  IF p_provider_refund_order_id IS NULL OR btrim(p_provider_refund_order_id) = ''
     OR char_length(p_provider_refund_order_id) > 128 THEN
    RAISE EXCEPTION 'invalid_provider_refund_order_id' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;

  -- Both sides required non-null and exactly equal.
  IF v_refund.provider_refund_order_id IS NULL
     OR v_refund.provider_refund_order_id <> p_provider_refund_order_id THEN
    RAISE EXCEPTION 'provider_refund_order_id_mismatch' USING ERRCODE='22023';
  END IF;

  -- Only approved may transition to processed. Processed replay allowed.
  IF v_refund.status NOT IN ('approved'::public.v2_refund_status,
                             'processed'::public.v2_refund_status) THEN
    RAISE EXCEPTION 'refund_not_approved' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_refund.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;

  v_new_event := public.v2_insert_or_verify_payment_event(
    v_order.id, 'upayments', p_external_event_id,
    'refunded'::public.v2_payment_event_type,
    v_refund.amount_fils, 'KWD',
    COALESCE(p_sanitized_payload,'{}'::jsonb));

  IF v_refund.status = 'processed'::public.v2_refund_status THEN
    -- Safe replay; no state or credit mutation.
    RETURN jsonb_build_object('ok', true, 'already_processed', true,
      'refund_id', v_refund.id, 'duplicate_event', NOT v_new_event);
  END IF;

  UPDATE public.refunds
     SET status = 'processed'::public.v2_refund_status,
         processed_at = now(),
         last_checked_at = now(),
         sanitized_provider_payload = COALESCE(p_sanitized_payload, sanitized_provider_payload),
         updated_at = now()
   WHERE id = p_refund_id;

  INSERT INTO public.lifetime_credit_entries (user_id, order_id, refund_id, amount_fils, reason)
  VALUES (v_order.user_id, NULL, v_refund.id, -v_refund.amount_fils, 'refund_processed')
  ON CONFLICT DO NOTHING;

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
END $function$;

-- =====================================================================
-- (7) v2_mark_verified_refund_failure: only pending -> failed. Never
-- overwrite approved/processed. Duplicate event collision-checked.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_mark_verified_refund_failure(
  p_admin_actor_id uuid, p_refund_id uuid, p_provider_refund_order_id text,
  p_result text, p_external_event_id text, p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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

  -- Never override terminal/approved states.
  IF v_refund.status = 'processed'::public.v2_refund_status THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'refund_id', v_refund.id,
      'status', 'processed');
  END IF;
  IF v_refund.status = 'approved'::public.v2_refund_status THEN
    RETURN jsonb_build_object('ok', true, 'noop', true, 'refund_id', v_refund.id,
      'status', 'approved');
  END IF;
  IF v_refund.status = 'failed'::public.v2_refund_status THEN
    -- Idempotent replay: verify event.
    PERFORM public.v2_insert_or_verify_payment_event(
      v_refund.order_id, 'upayments', p_external_event_id,
      'failed'::public.v2_payment_event_type,
      v_refund.amount_fils, 'KWD',
      COALESCE(p_sanitized_payload,'{}'::jsonb));
    RETURN jsonb_build_object('ok', true, 'noop', true, 'refund_id', v_refund.id,
      'status', 'failed');
  END IF;
  IF v_refund.status <> 'pending'::public.v2_refund_status THEN
    RAISE EXCEPTION 'refund_not_pending' USING ERRCODE='22023';
  END IF;

  PERFORM public.v2_insert_or_verify_payment_event(
    v_refund.order_id, 'upayments', p_external_event_id,
    'failed'::public.v2_payment_event_type,
    v_refund.amount_fils, 'KWD',
    COALESCE(p_sanitized_payload,'{}'::jsonb));

  UPDATE public.refunds
     SET status = 'failed'::public.v2_refund_status,
         last_checked_at = now(),
         sanitized_provider_payload = COALESCE(p_sanitized_payload, sanitized_provider_payload),
         updated_at = now()
   WHERE id = p_refund_id;

  RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id, 'status', 'failed');
END $function$;

-- =====================================================================
-- (8) Revoke EXECUTE from PUBLIC/anon/authenticated on internal trigger
-- helper functions. Triggers continue to work because they run under the
-- table owner and do not consult client role EXECUTE privileges.
-- =====================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'v2_check_bundle_item_parent_is_bundle',
         'v2_check_current_version_matches_resource',
         'v2_prevent_bundle_type_change',
         'v2_prevent_current_version_reassignment',
         'v2_validate_entitlement_version_major'
       )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;
