
-- =========================================================================
-- V2 Commerce Phase 2A
-- =========================================================================

-- 0A) Privilege hardening: raw provider payloads must be unreachable ------
REVOKE SELECT ON public.payment_attempts FROM authenticated, anon, PUBLIC;
REVOKE SELECT ON public.payment_events    FROM authenticated, anon, PUBLIC;
-- keep service_role full access (already granted)
GRANT ALL ON public.payment_attempts TO service_role;
GRANT ALL ON public.payment_events    TO service_role;

-- Drop RLS policies that now have no effect (table SELECT is revoked).
DROP POLICY IF EXISTS payment_attempts_owner_read ON public.payment_attempts;
DROP POLICY IF EXISTS payment_attempts_admin_read ON public.payment_attempts;
-- Keep RLS enabled as defense-in-depth.

-- 0B) Entitlements: permanent-only uniqueness --------------------------
DROP INDEX IF EXISTS public.entitlements_one_active_per_user_resource;
DROP INDEX IF EXISTS public.entitlements_one_active_library_per_user;

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_one_permanent_per_user_resource
  ON public.entitlements (user_id, resource_id)
  WHERE scope = 'resource'::public.v2_entitlement_scope
    AND revoked_at IS NULL
    AND expires_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS entitlements_one_permanent_library_per_user
  ON public.entitlements (user_id)
  WHERE scope = 'library'::public.v2_entitlement_scope
    AND revoked_at IS NULL
    AND expires_at IS NULL;

-- 0C) Admin-only paginated redacted read RPCs ---------------------------
CREATE OR REPLACE FUNCTION public.v2_admin_list_payment_attempts(
  p_limit int DEFAULT 50, p_offset int DEFAULT 0,
  p_order_id uuid DEFAULT NULL, p_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, order_id uuid, provider text, merchant_reference text,
  status text, track_id text, session_id text, provider_order_id text,
  expected_amount_fils int, currency text, checkout_url text,
  request_payload_size int, response_payload_size int, verified_payload_size int,
  last_checked_at timestamptz, next_check_after timestamptz, check_count int,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT pa.id, pa.order_id, pa.provider, pa.merchant_reference, pa.status,
         pa.track_id, pa.session_id, pa.provider_order_id,
         pa.expected_amount_fils, pa.currency, pa.checkout_url,
         octet_length(pa.request_payload::text),
         octet_length(pa.response_payload::text),
         octet_length(pa.verified_payload::text),
         pa.last_checked_at, pa.next_check_after, pa.check_count,
         pa.created_at, pa.updated_at
  FROM public.payment_attempts pa
  WHERE (p_order_id IS NULL OR pa.order_id = p_order_id)
    AND (p_status   IS NULL OR pa.status   = p_status)
  ORDER BY pa.created_at DESC
  LIMIT LEAST(GREATEST(p_limit,1),200) OFFSET GREATEST(p_offset,0);
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_list_payment_attempts(int,int,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_payment_attempts(int,int,uuid,text) TO authenticated;
-- has_role check inside enforces admin only; only authenticated can invoke.

CREATE OR REPLACE FUNCTION public.v2_admin_list_payment_events(
  p_limit int DEFAULT 50, p_offset int DEFAULT 0,
  p_order_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, order_id uuid, provider text,
  external_event_id text, event_type public.v2_payment_event_type,
  amount_fils int, currency text, raw_payload_size int,
  received_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT pe.id, pe.order_id, pe.provider, pe.external_event_id, pe.event_type,
         pe.amount_fils, pe.currency,
         octet_length(pe.raw_payload::text),
         pe.received_at, pe.created_at
  FROM public.payment_events pe
  WHERE (p_order_id IS NULL OR pe.order_id = p_order_id)
  ORDER BY pe.received_at DESC
  LIMIT LEAST(GREATEST(p_limit,1),200) OFFSET GREATEST(p_offset,0);
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_list_payment_events(int,int,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_payment_events(int,int,uuid) TO authenticated;

-- =========================================================================
-- 2) Private helper: apply paid state and grants (service-only)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_apply_paid_order_locked(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_order    record;
  v_item     record;
  v_bi       record;
  v_bundle_res_id uuid;
  v_current_ver uuid;
  v_major int;
  v_credit_before int;
  v_credit_after  int;
  v_granted_lifetime_threshold boolean := false;
  v_granted_lifetime_purchase  boolean := false;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;

  IF v_order.status = 'paid'::public.v2_order_status THEN
    RETURN jsonb_build_object('ok', true, 'already_paid', true, 'order_id', v_order.id);
  END IF;

  UPDATE public.orders
     SET status      = 'paid'::public.v2_order_status,
         paid_fils   = v_order.total_fils,
         placed_at   = COALESCE(v_order.placed_at, now()),
         settled_at  = now(),
         updated_at  = now()
   WHERE id = v_order.id;

  -- Iterate order items and grant
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
                                       scope, version_major)
      VALUES (v_order.user_id, v_item.resource_id, 'purchase'::public.v2_grant_reason,
              v_order.id, 'resource'::public.v2_entitlement_scope,
              v_item.acquired_major_version)
      ON CONFLICT DO NOTHING;

    ELSIF v_item.product_type = 'bundle'::public.v2_product_type THEN
      -- Optional root resource on the bundle product
      IF v_item.product_resource_id IS NOT NULL THEN
        SELECT rv.major_version INTO v_major
          FROM public.resources r
          LEFT JOIN public.resource_versions rv ON rv.id = r.current_version_id
         WHERE r.id = v_item.product_resource_id;
        INSERT INTO public.entitlements (user_id, resource_id, grant_reason, order_id,
                                         scope, version_major)
        VALUES (v_order.user_id, v_item.product_resource_id,
                'purchase'::public.v2_grant_reason, v_order.id,
                'resource'::public.v2_entitlement_scope, v_major)
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
                                         scope, version_major)
        VALUES (v_order.user_id, v_bi.resource_id,
                'purchase'::public.v2_grant_reason, v_order.id,
                'resource'::public.v2_entitlement_scope, v_bi.major_version)
        ON CONFLICT DO NOTHING;
      END LOOP;

    ELSIF v_item.product_type = 'lifetime'::public.v2_product_type THEN
      INSERT INTO public.entitlements (user_id, resource_id, grant_reason, order_id,
                                       scope, version_major)
      VALUES (v_order.user_id, NULL, 'lifetime_purchase'::public.v2_grant_reason,
              v_order.id, 'library'::public.v2_entitlement_scope, NULL)
      ON CONFLICT DO NOTHING;
      v_granted_lifetime_purchase := true;
    END IF;
  END LOOP;

  -- Positive credit entry for eligible paid amount (exclude zero-total settlement)
  IF v_order.paid_fils > 0 THEN
    INSERT INTO public.lifetime_credit_entries (user_id, order_id, refund_id, amount_fils, reason)
    VALUES (v_order.user_id, v_order.id, NULL, v_order.paid_fils, 'purchase_settled')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Consume reserved discount redemption exactly once
  UPDATE public.v2_discount_redemptions
     SET status = 'consumed', consumed_at = now(), updated_at = now()
   WHERE order_id = v_order.id AND status = 'reserved';

  -- Threshold check for non-lifetime orders: net credit >= 30000 triggers threshold lifetime once.
  IF NOT v_granted_lifetime_purchase THEN
    SELECT COALESCE(SUM(amount_fils),0) INTO v_credit_after
      FROM public.lifetime_credit_entries WHERE user_id = v_order.user_id;
    IF v_credit_after >= 30000 THEN
      INSERT INTO public.entitlements (user_id, resource_id, grant_reason, order_id,
                                       scope, version_major)
      VALUES (v_order.user_id, NULL, 'lifetime_threshold'::public.v2_grant_reason,
              v_order.id, 'library'::public.v2_entitlement_scope, NULL)
      ON CONFLICT DO NOTHING;
      v_granted_lifetime_threshold := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'order_id', v_order.id, 'paid_fils', v_order.paid_fils,
    'lifetime_purchase_granted', v_granted_lifetime_purchase,
    'lifetime_threshold_granted', v_granted_lifetime_threshold
  );
END $$;
REVOKE ALL ON FUNCTION public.v2_apply_paid_order_locked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_apply_paid_order_locked(uuid) TO service_role;

-- =========================================================================
-- 1) v2_create_checkout_order
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

  -- Idempotency retry
  SELECT * INTO v_existing_order FROM public.orders WHERE idempotency_key = p_idempotency_key;
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

  -- Dedupe product IDs preserving distinct set
  SELECT ARRAY(SELECT DISTINCT UNNEST(p_product_ids)) INTO v_dedup;

  -- Detect active library lifetime
  SELECT EXISTS (
    SELECT 1 FROM public.entitlements
     WHERE user_id = p_actor_user_id
       AND scope = 'library'::public.v2_entitlement_scope
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_active_lifetime;

  IF v_active_lifetime THEN
    RAISE EXCEPTION 'already_lifetime' USING ERRCODE='22023';
  END IF;

  -- Lock and validate products
  v_products_count := 0;
  FOR v_product IN
    SELECT p.* FROM public.products p
      WHERE p.id = ANY(v_dedup) AND p.is_active = true
      ORDER BY p.id
      FOR UPDATE
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
      IF v_bundle_total = 0 THEN
        -- degenerate bundle, treat as owned only if root already owned
        NULL;
      ELSE
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

  IF array_length(v_already_owned,1) IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_owned',
      'already_owned_resource_ids', to_jsonb(v_already_owned));
  END IF;

  -- Lifetime credit calculation
  IF v_has_lifetime THEN
    SELECT COALESCE(SUM(amount_fils),0) INTO v_credit
      FROM public.lifetime_credit_entries WHERE user_id = p_actor_user_id;
    IF v_credit < 0 THEN v_credit := 0; END IF;
    IF v_credit > v_lifetime_price THEN v_credit := v_lifetime_price; END IF;
    v_lifetime_credit_applied := v_credit;
    v_subtotal := v_lifetime_price; -- catalog authoritative
  END IF;

  -- Discount (bounded to subtotal after credit application for lifetime; otherwise subtotal)
  DECLARE v_base int; BEGIN
    v_base := CASE WHEN v_has_lifetime THEN v_lifetime_price - v_lifetime_credit_applied
                   ELSE v_subtotal END;
    IF p_discount_code IS NOT NULL AND btrim(p_discount_code) <> '' THEN
      SELECT * INTO v_discount FROM public.v2_discount_codes
        WHERE code_normalized = lower(btrim(p_discount_code))
        FOR UPDATE;
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

  -- Create order and support fields
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

  -- Snapshot order_items
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

  -- Payment attempt
  v_attempt_id := gen_random_uuid();
  INSERT INTO public.payment_attempts (id, order_id, provider, merchant_reference,
                                       expected_amount_fils, currency, status)
  VALUES (v_attempt_id, v_order_id, v_provider, v_merchant_ref, v_total, 'KWD',
          CASE WHEN v_total = 0 THEN 'verified_paid' ELSE 'created' END);

  -- Discount reservation
  IF v_discount.id IS NOT NULL THEN
    INSERT INTO public.v2_discount_redemptions (discount_code_id, user_id, order_id, amount_discount_fils)
    VALUES (v_discount.id, p_actor_user_id, v_order_id, v_discount_fils);
  END IF;

  -- Immutable created event
  INSERT INTO public.payment_events (order_id, provider, external_event_id, event_type,
                                     amount_fils, currency, raw_payload, received_at)
  VALUES (v_order_id, v_provider, 'local:created:' || v_order_id::text,
          'created'::public.v2_payment_event_type, v_total, 'KWD',
          jsonb_build_object('kind','created','order_id',v_order_id,'attempt_id',v_attempt_id),
          now());

  -- Zero-total: internal settlement in same transaction
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
REVOKE ALL ON FUNCTION public.v2_create_checkout_order(uuid,uuid[],text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_create_checkout_order(uuid,uuid[],text,text) TO service_role;

-- =========================================================================
-- 3) v2_record_upayments_charge_response
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_record_upayments_charge_response(
  p_actor_user_id uuid,
  p_order_id uuid,
  p_attempt_id uuid,
  p_merchant_reference text,
  p_track_id text,
  p_session_id text,
  p_provider_order_id text,
  p_checkout_url text,
  p_sanitized_response jsonb,
  p_external_event_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_order   record;
  v_attempt record;
BEGIN
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

  INSERT INTO public.payment_events (order_id, provider, external_event_id, event_type,
                                     amount_fils, currency, raw_payload, received_at)
  VALUES (p_order_id, 'upayments', p_external_event_id,
          'authorized'::public.v2_payment_event_type,
          v_attempt.expected_amount_fils, 'KWD',
          COALESCE(p_sanitized_response,'{}'::jsonb), now())
  ON CONFLICT (provider, external_event_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'attempt_id', p_attempt_id, 'status', 'redirect_ready');
END $$;
REVOKE ALL ON FUNCTION public.v2_record_upayments_charge_response(uuid,uuid,uuid,text,text,text,text,text,jsonb,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_record_upayments_charge_response(uuid,uuid,uuid,text,text,text,text,text,jsonb,text) TO service_role;

-- =========================================================================
-- 4) v2_settle_verified_upayments_payment
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_settle_verified_upayments_payment(
  p_actor_user_id uuid,
  p_order_id uuid,
  p_attempt_id uuid,
  p_merchant_reference text,
  p_track_id text,
  p_session_id text,
  p_provider_order_id text,
  p_amount_fils int,
  p_currency text,
  p_result text,
  p_external_event_id text,
  p_sanitized_verified_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_attempt record;
  v_result_norm text := upper(COALESCE(p_result,''));
  v_event_inserted boolean := false;
BEGIN
  IF v_result_norm NOT IN ('CAPTURED','SUCCESS','PAID') THEN
    RAISE EXCEPTION 'result_not_allowlisted' USING ERRCODE='22023';
  END IF;
  IF p_currency IS DISTINCT FROM 'KWD' THEN RAISE EXCEPTION 'invalid_currency' USING ERRCODE='22023'; END IF;
  IF octet_length(COALESCE(p_sanitized_verified_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;

  SELECT * INTO v_attempt FROM public.payment_attempts
    WHERE id = p_attempt_id AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found' USING ERRCODE='P0002'; END IF;

  IF v_attempt.provider <> 'upayments' THEN
    RAISE EXCEPTION 'provider_mismatch' USING ERRCODE='22023';
  END IF;
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

  INSERT INTO public.payment_events (order_id, provider, external_event_id, event_type,
                                     amount_fils, currency, raw_payload, received_at)
  VALUES (p_order_id, 'upayments', p_external_event_id,
          'captured'::public.v2_payment_event_type,
          p_amount_fils, 'KWD',
          COALESCE(p_sanitized_verified_payload,'{}'::jsonb), now())
  ON CONFLICT (provider, external_event_id) DO NOTHING;
  GET DIAGNOSTICS v_event_inserted = ROW_COUNT;

  IF NOT v_event_inserted THEN
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

  RETURN public.v2_apply_paid_order_locked(p_order_id);
END $$;
REVOKE ALL ON FUNCTION public.v2_settle_verified_upayments_payment(uuid,uuid,uuid,text,text,text,text,int,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_settle_verified_upayments_payment(uuid,uuid,uuid,text,text,text,text,int,text,text,text,jsonb) TO service_role;

-- =========================================================================
-- 5) v2_mark_verified_payment_failure
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_mark_verified_payment_failure(
  p_actor_user_id uuid,
  p_order_id uuid,
  p_attempt_id uuid,
  p_merchant_reference text,
  p_result text,
  p_external_event_id text,
  p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_order record;
  v_attempt record;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;

  SELECT * INTO v_attempt FROM public.payment_attempts
    WHERE id = p_attempt_id AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found' USING ERRCODE='P0002'; END IF;
  IF v_attempt.merchant_reference <> p_merchant_reference THEN
    RAISE EXCEPTION 'merchant_reference_mismatch' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.payment_events (order_id, provider, external_event_id, event_type,
                                     amount_fils, currency, raw_payload, received_at)
  VALUES (p_order_id, v_attempt.provider, p_external_event_id,
          'failed'::public.v2_payment_event_type,
          v_attempt.expected_amount_fils, 'KWD',
          COALESCE(p_sanitized_payload,'{}'::jsonb), now())
  ON CONFLICT (provider, external_event_id) DO NOTHING;

  UPDATE public.payment_attempts
     SET status = CASE WHEN status = 'verified_paid' THEN status ELSE 'failed' END,
         verified_payload = COALESCE(p_sanitized_payload, verified_payload),
         updated_at = now()
   WHERE id = p_attempt_id;

  IF v_order.status = 'pending'::public.v2_order_status THEN
    UPDATE public.orders SET status = 'failed'::public.v2_order_status, updated_at = now()
     WHERE id = p_order_id;
  END IF;

  UPDATE public.v2_discount_redemptions
     SET status = 'released', released_at = now(), updated_at = now()
   WHERE order_id = p_order_id AND status = 'reserved';

  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END $$;
REVOKE ALL ON FUNCTION public.v2_mark_verified_payment_failure(uuid,uuid,uuid,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_mark_verified_payment_failure(uuid,uuid,uuid,text,text,text,jsonb) TO service_role;

-- =========================================================================
-- 6) Customer read RPCs
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_checkout_state(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid();
        v_order record;
        v_items jsonb;
        v_attempt jsonb;
        v_progress jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;

  SELECT jsonb_agg(jsonb_build_object(
      'product_id', oi.product_id, 'resource_id', oi.resource_id,
      'quantity', oi.quantity, 'unit_price_fils', oi.unit_price_fils,
      'line_total_fils', oi.line_total_fils,
      'resource_version_id', oi.resource_version_id,
      'acquired_major_version', oi.acquired_major_version))
    INTO v_items
    FROM public.order_items oi WHERE oi.order_id = v_order.id;

  SELECT jsonb_build_object(
      'id', pa.id, 'provider', pa.provider, 'status', pa.status,
      'merchant_reference', pa.merchant_reference,
      'checkout_url', pa.checkout_url,
      'expected_amount_fils', pa.expected_amount_fils, 'currency', pa.currency)
    INTO v_attempt
    FROM public.payment_attempts pa
    WHERE pa.order_id = v_order.id
    ORDER BY pa.created_at DESC LIMIT 1;

  v_progress := public.v2_lifetime_progress();

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id, 'order_number', v_order.order_number,
      'status', v_order.status, 'currency', v_order.currency,
      'subtotal_fils', v_order.subtotal_fils, 'discount_fils', v_order.discount_fils,
      'lifetime_credit_applied_fils', v_order.lifetime_credit_applied_fils,
      'total_fils', v_order.total_fils, 'paid_fils', v_order.paid_fils,
      'placed_at', v_order.placed_at, 'settled_at', v_order.settled_at),
    'items', COALESCE(v_items,'[]'::jsonb),
    'attempt', v_attempt,
    'lifetime_progress', v_progress
  );
END $$;
-- Forward declare removed: v2_lifetime_progress defined below and re-created.

CREATE OR REPLACE FUNCTION public.v2_lifetime_progress()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid();
        v_net int := 0;
        v_capped int := 0;
        v_active boolean := false;
        v_source text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(SUM(amount_fils),0) INTO v_net
    FROM public.lifetime_credit_entries WHERE user_id = v_uid;
  v_capped := GREATEST(0, LEAST(v_net, 30000));
  SELECT true, e.grant_reason::text INTO v_active, v_source
    FROM public.entitlements e
   WHERE e.user_id = v_uid AND e.scope = 'library'::public.v2_entitlement_scope
     AND e.revoked_at IS NULL AND (e.expires_at IS NULL OR e.expires_at > now())
   ORDER BY e.granted_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'net_credit_fils', v_capped,
    'remaining_fils', GREATEST(0, 30000 - v_capped),
    'active_lifetime', COALESCE(v_active,false),
    'source', v_source
  );
END $$;
REVOKE ALL ON FUNCTION public.v2_lifetime_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_lifetime_progress() TO authenticated;

REVOKE ALL ON FUNCTION public.v2_checkout_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_checkout_state(uuid) TO authenticated;

-- =========================================================================
-- 7) Admin reconciliation summary
-- =========================================================================
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

  RETURN jsonb_build_object(
    'mismatches', v_mismatches,
    'pending_past_due', v_pending_past_due,
    'paid_without_entitlement', v_paid_without_entitlement,
    'credit_inconsistent', v_credit_inconsistent,
    'duplicate_event_risk', v_duplicate_event_risk,
    'as_of', now()
  );
END $$;
REVOKE ALL ON FUNCTION public.v2_admin_reconciliation_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_admin_reconciliation_summary() TO authenticated;
