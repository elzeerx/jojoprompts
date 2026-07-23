
-- Phase 3D: correlated refund wrappers with canonical lock order + real failure transition,
-- and hardened rejection audit RPC.

-- =============================================================
-- 1) Correlated APPLY (success) wrapper — canonical lock order.
-- =============================================================
CREATE OR REPLACE FUNCTION public.v2_apply_verified_refund_correlated(
  p_admin_actor_id uuid,
  p_refund_id uuid,
  p_provider_reference text,
  p_provider_refund_order_id text,
  p_result text,
  p_external_event_id text,
  p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_user_id uuid;
  v_order_id uuid;
  v_refund record;
  v_order record;
BEGIN
  IF p_admin_actor_id IS NULL
     OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;
  IF p_provider_reference IS NULL OR btrim(p_provider_reference) = ''
     OR p_provider_refund_order_id IS NULL OR btrim(p_provider_refund_order_id) = '' THEN
    RAISE EXCEPTION 'missing_refund_identifiers' USING ERRCODE='22023';
  END IF;

  -- Resolve owner WITHOUT any row locks first.
  SELECT r.order_id, o.user_id
    INTO v_order_id, v_user_id
    FROM public.refunds r
    JOIN public.orders o ON o.id = r.order_id
   WHERE r.id = p_refund_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002';
  END IF;

  -- Canonical: shared per-user advisory lock BEFORE any row locks.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('v2user:' || v_user_id::text, 0));

  -- Canonical row-lock order: order, then refund.
  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;
  IF v_order.user_id <> v_user_id THEN
    RAISE EXCEPTION 'ownership_shift_detected' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;
  IF v_refund.order_id <> v_order.id THEN
    RAISE EXCEPTION 'refund_order_mismatch' USING ERRCODE='22023';
  END IF;

  -- Post-lock re-validation of provider identifiers.
  IF v_refund.provider_reference IS DISTINCT FROM p_provider_reference
     OR v_refund.provider_refund_order_id IS DISTINCT FROM p_provider_refund_order_id THEN
    RAISE EXCEPTION 'refund_identifier_mismatch' USING ERRCODE='22023';
  END IF;

  -- Only approved (or processed replay) may pass through.
  IF v_refund.status NOT IN ('approved'::public.v2_refund_status,
                             'processed'::public.v2_refund_status) THEN
    RAISE EXCEPTION 'refund_not_approved' USING ERRCODE='22023';
  END IF;

  -- Inner apply re-takes the same row locks (no-op) and mutates.
  RETURN public.v2_apply_verified_refund(
    p_admin_actor_id, p_refund_id, p_provider_refund_order_id,
    p_result, p_external_event_id, p_sanitized_payload);
END $fn$;

-- =============================================================
-- 2) Correlated FAILURE wrapper — inline transition (never no-op on approved).
-- =============================================================
CREATE OR REPLACE FUNCTION public.v2_mark_verified_refund_failure_correlated(
  p_admin_actor_id uuid,
  p_refund_id uuid,
  p_provider_reference text,
  p_provider_refund_order_id text,
  p_result text,
  p_external_event_id text,
  p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_user_id uuid;
  v_order_id uuid;
  v_refund record;
  v_order record;
  v_result_norm text := upper(COALESCE(p_result,''));
  v_new_event boolean;
BEGIN
  IF p_admin_actor_id IS NULL
     OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;
  IF p_provider_reference IS NULL OR btrim(p_provider_reference) = ''
     OR p_provider_refund_order_id IS NULL OR btrim(p_provider_refund_order_id) = '' THEN
    RAISE EXCEPTION 'missing_refund_identifiers' USING ERRCODE='22023';
  END IF;
  -- Exact allowlist as emitted by normalizeRefundStatus refund-failed branch.
  IF v_result_norm NOT IN ('FAILED','DECLINED','ERROR','REJECTED','CANCELLED','CANCELED') THEN
    RAISE EXCEPTION 'result_not_allowlisted' USING ERRCODE='22023';
  END IF;
  IF p_external_event_id IS NULL OR btrim(p_external_event_id) = ''
     OR char_length(p_external_event_id) > 256 THEN
    RAISE EXCEPTION 'invalid_external_event_id' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  -- Resolve owner without row locks.
  SELECT r.order_id, o.user_id
    INTO v_order_id, v_user_id
    FROM public.refunds r
    JOIN public.orders o ON o.id = r.order_id
   WHERE r.id = p_refund_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002';
  END IF;

  -- Advisory FIRST.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('v2user:' || v_user_id::text, 0));

  -- Row locks: order, then refund.
  SELECT * INTO v_order FROM public.orders WHERE id = v_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;
  IF v_order.user_id <> v_user_id THEN
    RAISE EXCEPTION 'ownership_shift_detected' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;
  IF v_refund.order_id <> v_order.id THEN
    RAISE EXCEPTION 'refund_order_mismatch' USING ERRCODE='22023';
  END IF;

  -- Exact provider-ID equality post-lock.
  IF v_refund.provider_reference IS DISTINCT FROM p_provider_reference
     OR v_refund.provider_refund_order_id IS DISTINCT FROM p_provider_refund_order_id THEN
    RAISE EXCEPTION 'refund_identifier_mismatch' USING ERRCODE='22023';
  END IF;

  -- Processed is terminal-safe: never override.
  IF v_refund.status = 'processed'::public.v2_refund_status THEN
    RETURN jsonb_build_object('ok', true, 'noop', true,
      'refund_id', v_refund.id, 'status', 'processed');
  END IF;

  -- Idempotent replay of a prior failure with matching IDs and event.
  IF v_refund.status = 'failed'::public.v2_refund_status THEN
    PERFORM public.v2_insert_or_verify_payment_event(
      v_refund.order_id, 'upayments', p_external_event_id,
      'failed'::public.v2_payment_event_type,
      v_refund.amount_fils, 'KWD',
      COALESCE(p_sanitized_payload,'{}'::jsonb));
    RETURN jsonb_build_object('ok', true, 'noop', true,
      'refund_id', v_refund.id, 'status', 'failed');
  END IF;

  -- Only approved + submitted may transition to failed.
  IF v_refund.status <> 'approved'::public.v2_refund_status THEN
    RAISE EXCEPTION 'refund_not_approved' USING ERRCODE='22023';
  END IF;
  IF v_refund.provider_submission_state IS DISTINCT FROM 'submitted' THEN
    RAISE EXCEPTION 'submission_state_not_submitted' USING ERRCODE='22023';
  END IF;

  -- Deterministic Phase-3C status_failed event: insert or verify exact match.
  v_new_event := public.v2_insert_or_verify_payment_event(
    v_refund.order_id, 'upayments', p_external_event_id,
    'failed'::public.v2_payment_event_type,
    v_refund.amount_fils, 'KWD',
    COALESCE(p_sanitized_payload,'{}'::jsonb));

  -- Failure: mark refund failed. Never touch entitlements, lifetime credit,
  -- order paid/refunded state, or revoke anything.
  UPDATE public.refunds
     SET status = 'failed'::public.v2_refund_status,
         last_checked_at = now(),
         sanitized_provider_payload = COALESCE(p_sanitized_payload, sanitized_provider_payload),
         updated_at = now()
   WHERE id = p_refund_id;

  RETURN jsonb_build_object('ok', true, 'refund_id', p_refund_id,
    'status', 'failed', 'duplicate_event', NOT v_new_event);
END $fn$;

-- =============================================================
-- 3) Rejection audit: require actor + verify relations.
-- =============================================================
CREATE OR REPLACE FUNCTION public.v2_record_upayments_verification_rejection(
  p_actor_user_id uuid,
  p_order_id uuid,
  p_attempt_id uuid,
  p_external_event_id text,
  p_reason text,
  p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE
  v_order_user uuid;
  v_attempt_ok boolean;
  v_exists boolean;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'actor_required' USING ERRCODE='22023';
  END IF;
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

  -- Order must exist; actor must be its owner.
  SELECT user_id INTO v_order_user FROM public.orders WHERE id = p_order_id;
  IF v_order_user IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002';
  END IF;
  IF v_order_user <> p_actor_user_id THEN
    RAISE EXCEPTION 'actor_not_owner' USING ERRCODE='42501';
  END IF;

  -- Attempt must belong to that order and be an UPayments attempt.
  SELECT EXISTS (
    SELECT 1 FROM public.payment_attempts
     WHERE id = p_attempt_id
       AND order_id = p_order_id
       AND provider = 'upayments'
  ) INTO v_attempt_ok;
  IF NOT v_attempt_ok THEN
    RAISE EXCEPTION 'attempt_not_found' USING ERRCODE='P0002';
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
END $fn$;

-- =============================================================
-- 4) ACL lockdown: service_role only.
-- =============================================================
REVOKE ALL ON FUNCTION public.v2_apply_verified_refund_correlated(uuid,uuid,text,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v2_mark_verified_refund_failure_correlated(uuid,uuid,text,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.v2_record_upayments_verification_rejection(uuid,uuid,uuid,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.v2_apply_verified_refund_correlated(uuid,uuid,text,text,text,text,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.v2_mark_verified_refund_failure_correlated(uuid,uuid,text,text,text,text,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.v2_record_upayments_verification_rejection(uuid,uuid,uuid,text,text,jsonb)
  TO service_role;
