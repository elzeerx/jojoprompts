
-- Phase 3C: atomic terminal refund correlation, sanitized rejection audit,
-- ownership-first attempt lookup. Forward-only; no history rewrite.

-- 1) Atomic correlated refund success
CREATE OR REPLACE FUNCTION public.v2_apply_verified_refund_correlated(
  p_admin_actor_id uuid,
  p_refund_id uuid,
  p_provider_reference text,
  p_provider_refund_order_id text,
  p_result text,
  p_external_event_id text,
  p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_refund record;
  v_order record;
  v_res jsonb;
BEGIN
  IF p_admin_actor_id IS NULL
     OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;
  IF p_provider_reference IS NULL OR btrim(p_provider_reference) = ''
     OR p_provider_refund_order_id IS NULL OR btrim(p_provider_refund_order_id) = '' THEN
    RAISE EXCEPTION 'missing_refund_identifiers' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_refund.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('v2user:' || v_order.user_id::text, 0));

  IF v_refund.provider_reference IS DISTINCT FROM p_provider_reference
     OR v_refund.provider_refund_order_id IS DISTINCT FROM p_provider_refund_order_id THEN
    RAISE EXCEPTION 'refund_identifier_mismatch' USING ERRCODE='22023';
  END IF;

  IF v_refund.status NOT IN ('approved'::public.v2_refund_status,
                              'processed'::public.v2_refund_status) THEN
    RAISE EXCEPTION 'refund_not_approved' USING ERRCODE='22023';
  END IF;

  v_res := public.v2_apply_verified_refund(
    p_admin_actor_id, p_refund_id, p_provider_refund_order_id,
    p_result, p_external_event_id, p_sanitized_payload);
  RETURN v_res;
END $function$;

REVOKE ALL ON FUNCTION public.v2_apply_verified_refund_correlated(
  uuid, uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_apply_verified_refund_correlated(
  uuid, uuid, text, text, text, text, jsonb) TO service_role;

-- 2) Atomic correlated refund failure
CREATE OR REPLACE FUNCTION public.v2_mark_verified_refund_failure_correlated(
  p_admin_actor_id uuid,
  p_refund_id uuid,
  p_provider_reference text,
  p_provider_refund_order_id text,
  p_result text,
  p_external_event_id text,
  p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_refund record;
  v_order record;
  v_res jsonb;
BEGIN
  IF p_admin_actor_id IS NULL
     OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;
  IF p_provider_reference IS NULL OR btrim(p_provider_reference) = ''
     OR p_provider_refund_order_id IS NULL OR btrim(p_provider_refund_order_id) = '' THEN
    RAISE EXCEPTION 'missing_refund_identifiers' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_refund.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('v2user:' || v_order.user_id::text, 0));

  IF v_refund.provider_reference IS DISTINCT FROM p_provider_reference
     OR v_refund.provider_refund_order_id IS DISTINCT FROM p_provider_refund_order_id THEN
    RAISE EXCEPTION 'refund_identifier_mismatch' USING ERRCODE='22023';
  END IF;

  v_res := public.v2_mark_verified_refund_failure(
    p_admin_actor_id, p_refund_id, p_provider_refund_order_id,
    p_result, p_external_event_id, p_sanitized_payload);
  RETURN v_res;
END $function$;

REVOKE ALL ON FUNCTION public.v2_mark_verified_refund_failure_correlated(
  uuid, uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_mark_verified_refund_failure_correlated(
  uuid, uuid, text, text, text, text, jsonb) TO service_role;

-- 3) Verification rejection audit (non-money-state)
CREATE OR REPLACE FUNCTION public.v2_record_upayments_verification_rejection(
  p_actor_user_id uuid,
  p_order_id uuid,
  p_attempt_id uuid,
  p_external_event_id text,
  p_reason text,
  p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_exists boolean;
BEGIN
  IF p_attempt_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE='22023';
  END IF;
  IF p_external_event_id IS NULL OR btrim(p_external_event_id) = ''
     OR char_length(p_external_event_id) > 256 THEN
    RAISE EXCEPTION 'invalid_external_event_id' USING ERRCODE='22023';
  END IF;
  IF p_reason NOT IN (
       'missing_merchant_reference','merchant_reference_mismatch',
       'track_id_mismatch','session_id_mismatch','provider_order_id_mismatch',
       'currency_missing','currency_mismatch',
       'amount_missing','amount_unparseable','amount_mismatch') THEN
    RAISE EXCEPTION 'invalid_reason' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('v2rej:' || p_external_event_id, 0));

  SELECT EXISTS (
    SELECT 1 FROM public.activity_events
     WHERE action = 'upayments_verification_rejected'
       AND entity_type = 'payment_attempt'
       AND entity_id = p_attempt_id
       AND metadata ->> 'external_event_id' = p_external_event_id
  ) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  ) VALUES (
    p_actor_user_id, 'system', 'payment_attempt', p_attempt_id,
    'upayments_verification_rejected',
    jsonb_build_object(
      'external_event_id', p_external_event_id,
      'reason', p_reason,
      'order_id', p_order_id,
      'payload', COALESCE(p_sanitized_payload, '{}'::jsonb)
    )
  );
  RETURN jsonb_build_object('ok', true, 'duplicate', false);
END $function$;

REVOKE ALL ON FUNCTION public.v2_record_upayments_verification_rejection(
  uuid, uuid, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_record_upayments_verification_rejection(
  uuid, uuid, uuid, text, text, jsonb) TO service_role;

-- 4) Ownership-first latest UPayments attempt lookup
CREATE OR REPLACE FUNCTION public.v2_resolve_owned_latest_upayments_attempt(
  p_actor_user_id uuid,
  p_order_id uuid,
  p_allow_admin boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE v_owner uuid; v_attempt_id uuid;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;
  SELECT user_id INTO v_owner FROM public.orders WHERE id = p_order_id;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_owner <> p_actor_user_id THEN
    IF NOT (COALESCE(p_allow_admin,false)
            AND public.has_role(p_actor_user_id,'admin'::public.app_role)) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
  END IF;
  SELECT id INTO v_attempt_id
    FROM public.payment_attempts
   WHERE order_id = p_order_id
     AND provider = 'upayments'
   ORDER BY created_at DESC
   LIMIT 1;
  IF v_attempt_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_attempt');
  END IF;
  RETURN jsonb_build_object('ok', true, 'attempt_id', v_attempt_id);
END $function$;

REVOKE ALL ON FUNCTION public.v2_resolve_owned_latest_upayments_attempt(
  uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_resolve_owned_latest_upayments_attempt(
  uuid, uuid, boolean) TO service_role;
