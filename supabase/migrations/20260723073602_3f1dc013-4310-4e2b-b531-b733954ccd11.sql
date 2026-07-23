
-- =====================================================================
-- V2 Commerce Phase 3B: correlation hardening + global status rate limit.
-- Forward-only additive. All surfaces service_role-only.
-- =====================================================================

-- (B1) Private global provider-status rate-limit table.
CREATE TABLE IF NOT EXISTS public.v2_provider_status_rate_limit (
  minute_bucket timestamptz PRIMARY KEY,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.v2_provider_status_rate_limit FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.v2_provider_status_rate_limit TO service_role;
ALTER TABLE public.v2_provider_status_rate_limit ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role bypasses RLS.

CREATE OR REPLACE FUNCTION public.v2_reserve_status_slot(p_cap int DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_bucket timestamptz; v_new int;
BEGIN
  IF p_cap IS NULL OR p_cap < 1 OR p_cap > 1000 THEN
    RAISE EXCEPTION 'invalid_cap' USING ERRCODE='22023';
  END IF;
  v_bucket := date_trunc('minute', (now() AT TIME ZONE 'utc')) AT TIME ZONE 'utc';

  INSERT INTO public.v2_provider_status_rate_limit (minute_bucket, count)
    VALUES (v_bucket, 0)
    ON CONFLICT (minute_bucket) DO NOTHING;

  UPDATE public.v2_provider_status_rate_limit
     SET count = count + 1, updated_at = now()
   WHERE minute_bucket = v_bucket AND count < p_cap
   RETURNING count INTO v_new;

  IF v_new IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'global_backoff',
      'minute_bucket', v_bucket);
  END IF;

  -- Best-effort cleanup of stale buckets.
  DELETE FROM public.v2_provider_status_rate_limit
    WHERE minute_bucket < v_bucket - interval '1 hour';

  RETURN jsonb_build_object('ok', true, 'count', v_new, 'minute_bucket', v_bucket);
END $fn$;
REVOKE ALL ON FUNCTION public.v2_reserve_status_slot(int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_reserve_status_slot(int) TO service_role;

-- =====================================================================
-- (B2) v2_claim_payment_status_check: reserve global slot BEFORE any
-- per-record counter/backoff mutation. On global_backoff mutate nothing.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_claim_payment_status_check(
  p_actor_user_id uuid, p_order_id uuid, p_attempt_id uuid, p_allow_admin boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_order record; v_attempt record;
        v_next interval; v_delay_sec int; v_slot jsonb;
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;

  IF v_order.user_id <> p_actor_user_id THEN
    IF NOT (COALESCE(p_allow_admin,false)
            AND public.has_role(p_actor_user_id,'admin'::public.app_role)) THEN
      RAISE EXCEPTION 'actor_not_authorized' USING ERRCODE='42501';
    END IF;
  END IF;

  SELECT * INTO v_attempt FROM public.payment_attempts
    WHERE id = p_attempt_id AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found' USING ERRCODE='P0002'; END IF;
  IF v_attempt.provider <> 'upayments' THEN
    RAISE EXCEPTION 'provider_mismatch' USING ERRCODE='22023';
  END IF;
  IF (v_attempt.track_id IS NULL OR btrim(v_attempt.track_id)='')
     AND (v_attempt.session_id IS NULL OR btrim(v_attempt.session_id)='') THEN
    RAISE EXCEPTION 'no_provider_identifier' USING ERRCODE='22023';
  END IF;
  IF v_attempt.next_check_after IS NOT NULL AND v_attempt.next_check_after > now() THEN
    RETURN jsonb_build_object('ok', false, 'error','backoff_active',
      'next_check_after', v_attempt.next_check_after,
      'check_count', v_attempt.check_count);
  END IF;

  -- Global cap: reserve BEFORE mutating per-record backoff.
  v_slot := public.v2_reserve_status_slot(25);
  IF (v_slot->>'ok')::boolean IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'global_backoff');
  END IF;

  v_delay_sec := LEAST(300, GREATEST(2, POWER(2, LEAST(v_attempt.check_count, 8))::int));
  v_next := (v_delay_sec::text || ' seconds')::interval;

  UPDATE public.payment_attempts
     SET check_count = check_count + 1,
         last_checked_at = now(),
         next_check_after = now() + v_next,
         updated_at = now()
   WHERE id = v_attempt.id;

  RETURN jsonb_build_object(
    'ok', true, 'claimed', true,
    'order_id', v_order.id, 'attempt_id', v_attempt.id,
    'order_user_id', v_order.user_id,
    'merchant_reference', v_attempt.merchant_reference,
    'amount_fils', v_attempt.expected_amount_fils,
    'currency', v_attempt.currency,
    'track_id', v_attempt.track_id,
    'session_id', v_attempt.session_id,
    'provider_order_id', v_attempt.provider_order_id,
    'check_count', v_attempt.check_count + 1,
    'next_check_after', now() + v_next);
END $fn$;
REVOKE ALL ON FUNCTION public.v2_claim_payment_status_check(uuid,uuid,uuid,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_claim_payment_status_check(uuid,uuid,uuid,boolean) TO service_role;

-- =====================================================================
-- (B3) v2_claim_refund_status_check: strict preconditions + global slot.
-- Requires refund.status = approved AND provider_submission_state = submitted
-- AND both provider_reference AND provider_refund_order_id are non-blank.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_claim_refund_status_check(
  p_admin_actor_id uuid, p_refund_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_refund record; v_next interval; v_delay_sec int; v_slot jsonb;
BEGIN
  IF p_admin_actor_id IS NULL
     OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;

  IF v_refund.status <> 'approved'::public.v2_refund_status THEN
    RAISE EXCEPTION 'refund_not_pollable' USING ERRCODE='22023';
  END IF;
  IF v_refund.provider_submission_state <> 'submitted' THEN
    RAISE EXCEPTION 'refund_not_pollable' USING ERRCODE='22023';
  END IF;
  IF v_refund.provider_reference IS NULL OR btrim(v_refund.provider_reference) = '' THEN
    RAISE EXCEPTION 'missing_provider_reference' USING ERRCODE='22023';
  END IF;
  IF v_refund.provider_refund_order_id IS NULL
     OR btrim(v_refund.provider_refund_order_id) = '' THEN
    RAISE EXCEPTION 'missing_provider_refund_order_id' USING ERRCODE='22023';
  END IF;

  IF v_refund.next_check_after IS NOT NULL AND v_refund.next_check_after > now() THEN
    RETURN jsonb_build_object('ok', false, 'error','backoff_active',
      'next_check_after', v_refund.next_check_after,
      'check_count', v_refund.check_count);
  END IF;

  v_slot := public.v2_reserve_status_slot(25);
  IF (v_slot->>'ok')::boolean IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'global_backoff');
  END IF;

  v_delay_sec := LEAST(300, GREATEST(2, POWER(2, LEAST(v_refund.check_count, 8))::int));
  v_next := (v_delay_sec::text || ' seconds')::interval;

  UPDATE public.refunds
     SET check_count = check_count + 1,
         last_checked_at = now(),
         next_check_after = now() + v_next,
         updated_at = now()
   WHERE id = v_refund.id;

  RETURN jsonb_build_object(
    'ok', true, 'claimed', true,
    'refund_id', v_refund.id, 'order_id', v_refund.order_id,
    'amount_fils', v_refund.amount_fils, 'currency','KWD',
    'provider_reference', v_refund.provider_reference,
    'provider_refund_order_id', v_refund.provider_refund_order_id,
    'check_count', v_refund.check_count + 1,
    'next_check_after', now() + v_next);
END $fn$;
REVOKE ALL ON FUNCTION public.v2_claim_refund_status_check(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_claim_refund_status_check(uuid,uuid) TO service_role;

-- =====================================================================
-- (B4) v2_record_upayments_refund_response: new 6-arg signature.
-- Stores BOTH provider identifiers separately:
--   provider_reference        = create-refund response data.orderId
--   provider_refund_order_id  = create-refund response data.refundOrderId
-- Requires submission_state 'submitting' -> 'submitted' and
-- status 'pending' -> 'approved'.
-- =====================================================================
DROP FUNCTION IF EXISTS public.v2_record_upayments_refund_response(uuid,uuid,text,text,jsonb);

CREATE OR REPLACE FUNCTION public.v2_record_upayments_refund_response(
  p_admin_actor_id uuid, p_refund_id uuid,
  p_provider_reference text, p_provider_refund_order_id text,
  p_external_event_id text, p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_refund record;
BEGIN
  IF p_admin_actor_id IS NULL
     OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;
  IF p_provider_reference IS NULL OR btrim(p_provider_reference) = ''
     OR char_length(p_provider_reference) > 128 THEN
    RAISE EXCEPTION 'invalid_provider_reference' USING ERRCODE='22023';
  END IF;
  IF p_provider_refund_order_id IS NULL OR btrim(p_provider_refund_order_id) = ''
     OR char_length(p_provider_refund_order_id) > 128 THEN
    RAISE EXCEPTION 'invalid_provider_refund_order_id' USING ERRCODE='22023';
  END IF;
  IF p_external_event_id IS NULL OR btrim(p_external_event_id) = ''
     OR char_length(p_external_event_id) > 256 THEN
    RAISE EXCEPTION 'invalid_external_event_id' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;

  -- Idempotent replay: exact same IDs on already-approved+submitted row.
  IF v_refund.status = 'approved'::public.v2_refund_status
     AND v_refund.provider_submission_state = 'submitted' THEN
    IF v_refund.provider_reference IS DISTINCT FROM p_provider_reference
       OR v_refund.provider_refund_order_id IS DISTINCT FROM p_provider_refund_order_id THEN
      RAISE EXCEPTION 'refund_identifier_replay_mismatch' USING ERRCODE='22023';
    END IF;
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
  IF v_refund.provider_submission_state <> 'submitting' THEN
    RAISE EXCEPTION 'submission_state_invalid' USING ERRCODE='22023';
  END IF;

  UPDATE public.refunds
     SET status = 'approved'::public.v2_refund_status,
         provider_reference = p_provider_reference,
         provider_refund_order_id = p_provider_refund_order_id,
         provider_submission_state = 'submitted',
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
END $fn$;
REVOKE ALL ON FUNCTION public.v2_record_upayments_refund_response(uuid,uuid,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_record_upayments_refund_response(uuid,uuid,text,text,text,jsonb) TO service_role;

-- =====================================================================
-- (B5) v2_assert_refund_identifiers: gate for refund-terminal application.
-- Verifies BOTH stored provider IDs equal caller-supplied values AND the
-- refund is in an appliable state. Called immediately before the existing
-- v2_apply_verified_refund or v2_mark_verified_refund_failure.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_assert_refund_identifiers(
  p_refund_id uuid, p_provider_reference text, p_provider_refund_order_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_refund record;
BEGIN
  IF p_provider_reference IS NULL OR btrim(p_provider_reference) = ''
     OR p_provider_refund_order_id IS NULL OR btrim(p_provider_refund_order_id) = '' THEN
    RAISE EXCEPTION 'missing_refund_identifiers' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;

  IF v_refund.provider_reference IS DISTINCT FROM p_provider_reference
     OR v_refund.provider_refund_order_id IS DISTINCT FROM p_provider_refund_order_id THEN
    RAISE EXCEPTION 'refund_identifier_mismatch' USING ERRCODE='22023';
  END IF;

  IF v_refund.status NOT IN ('approved'::public.v2_refund_status,
                             'processed'::public.v2_refund_status) THEN
    RAISE EXCEPTION 'refund_not_approved' USING ERRCODE='22023';
  END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.v2_assert_refund_identifiers(uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_assert_refund_identifiers(uuid,text,text) TO service_role;
