
-- =====================================================================
-- V2 Commerce Phase 3A: durable submission claim state + service-only
-- claim/backoff RPCs used exclusively by V2 UPayments edge functions.
-- Provider calls remain disabled unless V2_UPAYMENTS_ENABLED=true.
-- =====================================================================

-- (A1) payment_attempts columns
ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS provider_submission_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS provider_submission_state text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS last_provider_http_status int NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payment_attempts_submission_state_chk') THEN
    ALTER TABLE public.payment_attempts
      ADD CONSTRAINT payment_attempts_submission_state_chk
      CHECK (provider_submission_state IN ('not_started','submitting','submitted','submission_unknown','failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payment_attempts_http_status_chk') THEN
    ALTER TABLE public.payment_attempts
      ADD CONSTRAINT payment_attempts_http_status_chk
      CHECK (last_provider_http_status IS NULL OR last_provider_http_status BETWEEN 100 AND 599);
  END IF;
END $$;

-- (A2) refunds columns
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS provider_submission_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS provider_submission_state text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS next_check_after timestamptz NULL,
  ADD COLUMN IF NOT EXISTS check_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_provider_http_status int NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='refunds_submission_state_chk') THEN
    ALTER TABLE public.refunds
      ADD CONSTRAINT refunds_submission_state_chk
      CHECK (provider_submission_state IN ('not_started','submitting','submitted','submission_unknown','failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='refunds_http_status_chk') THEN
    ALTER TABLE public.refunds
      ADD CONSTRAINT refunds_http_status_chk
      CHECK (last_provider_http_status IS NULL OR last_provider_http_status BETWEEN 100 AND 599);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='refunds_check_count_chk') THEN
    ALTER TABLE public.refunds
      ADD CONSTRAINT refunds_check_count_chk CHECK (check_count >= 0);
  END IF;
END $$;

-- =====================================================================
-- (A3) v2_claim_charge_submission
-- Atomic claim before POST /charge. Owner-actor only. Replay-safe.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_claim_charge_submission(
  p_actor_user_id uuid, p_order_id uuid, p_attempt_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_order record; v_attempt record;
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;
  IF v_order.user_id <> p_actor_user_id THEN
    RAISE EXCEPTION 'actor_not_owner' USING ERRCODE='42501';
  END IF;
  IF v_order.status <> 'pending'::public.v2_order_status THEN
    RAISE EXCEPTION 'order_not_pending' USING ERRCODE='22023';
  END IF;
  IF v_order.total_fils <= 0 THEN
    RAISE EXCEPTION 'order_zero_total' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_attempt FROM public.payment_attempts
    WHERE id = p_attempt_id AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found' USING ERRCODE='P0002'; END IF;
  IF v_attempt.provider <> 'upayments' THEN
    RAISE EXCEPTION 'provider_mismatch' USING ERRCODE='22023';
  END IF;

  -- Idempotent replay: already have a usable hosted checkout URL.
  IF v_attempt.provider_submission_state = 'submitted'
     AND v_attempt.checkout_url IS NOT NULL
     AND v_attempt.status IN ('redirect_ready','pending') THEN
    RETURN jsonb_build_object(
      'ok', true, 'claimed', false, 'replay', true,
      'checkout_url', v_attempt.checkout_url,
      'order_id', v_order.id, 'attempt_id', v_attempt.id,
      'merchant_reference', v_attempt.merchant_reference,
      'amount_fils', v_attempt.expected_amount_fils,
      'currency', v_attempt.currency);
  END IF;

  -- Ambiguous / in-flight: never authorize another submission.
  IF v_attempt.provider_submission_state IN ('submitting','submission_unknown') THEN
    RETURN jsonb_build_object(
      'ok', false, 'claimed', false, 'error', 'recovery_required',
      'provider_submission_state', v_attempt.provider_submission_state,
      'order_id', v_order.id, 'attempt_id', v_attempt.id);
  END IF;

  IF v_attempt.provider_submission_state <> 'not_started' THEN
    RAISE EXCEPTION 'submission_state_invalid:%', v_attempt.provider_submission_state USING ERRCODE='22023';
  END IF;

  UPDATE public.payment_attempts
     SET provider_submission_state = 'submitting',
         provider_submission_started_at = now(),
         updated_at = now()
   WHERE id = v_attempt.id
     AND provider_submission_state = 'not_started';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false, 'claimed', false, 'error', 'recovery_required',
      'order_id', v_order.id, 'attempt_id', v_attempt.id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'claimed', true,
    'order_id', v_order.id, 'attempt_id', v_attempt.id,
    'merchant_reference', v_attempt.merchant_reference,
    'amount_fils', v_attempt.expected_amount_fils,
    'currency', v_attempt.currency);
END $fn$;

REVOKE ALL ON FUNCTION public.v2_claim_charge_submission(uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_claim_charge_submission(uuid,uuid,uuid) TO service_role;

-- =====================================================================
-- (A4) v2_record_charge_submission_unknown
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_record_charge_submission_unknown(
  p_actor_user_id uuid, p_order_id uuid, p_attempt_id uuid,
  p_http_status int, p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_order record; v_attempt record; v_evt_id text;
BEGIN
  IF p_actor_user_id IS NULL THEN RAISE EXCEPTION 'actor_required' USING ERRCODE='22023'; END IF;
  IF p_http_status IS NOT NULL AND (p_http_status < 100 OR p_http_status > 599) THEN
    RAISE EXCEPTION 'invalid_http_status' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.user_id <> p_actor_user_id THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002';
  END IF;

  SELECT * INTO v_attempt FROM public.payment_attempts
    WHERE id = p_attempt_id AND order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'attempt_not_found' USING ERRCODE='P0002'; END IF;
  IF v_attempt.provider_submission_state <> 'submitting' THEN
    RAISE EXCEPTION 'submission_state_invalid:%', v_attempt.provider_submission_state USING ERRCODE='22023';
  END IF;

  UPDATE public.payment_attempts
     SET provider_submission_state = 'submission_unknown',
         last_provider_http_status = p_http_status,
         response_payload = COALESCE(p_sanitized_payload, response_payload),
         updated_at = now()
   WHERE id = v_attempt.id;

  v_evt_id := 'local:charge_submission_unknown:' || v_attempt.id::text;
  PERFORM public.v2_insert_or_verify_payment_event(
    v_order.id, 'upayments', v_evt_id,
    'authorized'::public.v2_payment_event_type,
    v_attempt.expected_amount_fils, v_attempt.currency,
    jsonb_build_object('kind','submission_unknown','attempt_id',v_attempt.id));

  RETURN jsonb_build_object('ok', true, 'attempt_id', v_attempt.id,
    'provider_submission_state', 'submission_unknown');
END $fn$;

REVOKE ALL ON FUNCTION public.v2_record_charge_submission_unknown(uuid,uuid,uuid,int,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_record_charge_submission_unknown(uuid,uuid,uuid,int,jsonb) TO service_role;

-- =====================================================================
-- (A5) Strengthen v2_record_upayments_charge_response
-- Only 'submitting' -> 'submitted'; enforce actor/order/attempt/
-- merchant/amount invariants; safe replay.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_record_upayments_charge_response(
  p_actor_user_id uuid, p_order_id uuid, p_attempt_id uuid, p_merchant_reference text,
  p_track_id text, p_session_id text, p_provider_order_id text, p_checkout_url text,
  p_sanitized_response jsonb, p_external_event_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_order record; v_attempt record;
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

  -- Safe replay: already submitted with same provider ids and URL.
  IF v_attempt.provider_submission_state = 'submitted' THEN
    IF (v_attempt.track_id IS NOT NULL AND p_track_id IS NOT NULL AND v_attempt.track_id <> p_track_id)
       OR (v_attempt.session_id IS NOT NULL AND p_session_id IS NOT NULL AND v_attempt.session_id <> p_session_id)
       OR (v_attempt.provider_order_id IS NOT NULL AND p_provider_order_id IS NOT NULL
           AND v_attempt.provider_order_id <> p_provider_order_id) THEN
      RAISE EXCEPTION 'identifier_replay_mismatch' USING ERRCODE='22023';
    END IF;
    PERFORM public.v2_insert_or_verify_payment_event(
      p_order_id, 'upayments', p_external_event_id,
      'authorized'::public.v2_payment_event_type,
      v_attempt.expected_amount_fils, 'KWD',
      COALESCE(p_sanitized_response,'{}'::jsonb));
    RETURN jsonb_build_object('ok', true, 'attempt_id', p_attempt_id,
      'status', 'redirect_ready', 'replay', true,
      'checkout_url', v_attempt.checkout_url);
  END IF;

  IF v_attempt.provider_submission_state <> 'submitting' THEN
    RAISE EXCEPTION 'submission_state_invalid:%', v_attempt.provider_submission_state USING ERRCODE='22023';
  END IF;

  UPDATE public.payment_attempts
     SET status = 'redirect_ready',
         provider_submission_state = 'submitted',
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

  RETURN jsonb_build_object('ok', true, 'attempt_id', p_attempt_id,
    'status', 'redirect_ready', 'checkout_url', p_checkout_url);
END $function$;

-- =====================================================================
-- (A6) v2_claim_payment_status_check
-- Owner OR admin (server-mediated webhook path) may claim. Enforces
-- exponential backoff and increments counters. Never trusts external
-- caller-supplied actor for webhook path.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_claim_payment_status_check(
  p_actor_user_id uuid, p_order_id uuid, p_attempt_id uuid, p_allow_admin boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_order record; v_attempt record;
        v_next interval; v_delay_sec int;
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
-- (A7) v2_claim_refund_submission
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_claim_refund_submission(
  p_admin_actor_id uuid, p_refund_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_refund record; v_order record; v_attempt record;
BEGIN
  IF p_admin_actor_id IS NULL OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;
  IF v_refund.status <> 'pending'::public.v2_refund_status THEN
    RAISE EXCEPTION 'refund_not_pending' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_refund.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002'; END IF;

  SELECT * INTO v_attempt FROM public.payment_attempts
    WHERE order_id = v_order.id AND provider = 'upayments'
      AND status = 'verified_paid'
    ORDER BY updated_at DESC LIMIT 1;

  IF v_refund.provider_submission_state IN ('submitting','submission_unknown','submitted') THEN
    RETURN jsonb_build_object(
      'ok', false, 'claimed', false, 'error','recovery_required',
      'provider_submission_state', v_refund.provider_submission_state,
      'refund_id', v_refund.id);
  END IF;
  IF v_refund.provider_submission_state <> 'not_started' THEN
    RAISE EXCEPTION 'submission_state_invalid:%', v_refund.provider_submission_state USING ERRCODE='22023';
  END IF;

  UPDATE public.refunds
     SET provider_submission_state = 'submitting',
         provider_submission_started_at = now(),
         updated_at = now()
   WHERE id = v_refund.id
     AND provider_submission_state = 'not_started';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'claimed', false, 'error','recovery_required',
      'refund_id', v_refund.id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'claimed', true,
    'refund_id', v_refund.id, 'order_id', v_order.id,
    'amount_fils', v_refund.amount_fils, 'currency', 'KWD',
    'original_provider_order_id', v_attempt.provider_order_id,
    'original_track_id', v_attempt.track_id);
END $fn$;

REVOKE ALL ON FUNCTION public.v2_claim_refund_submission(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_claim_refund_submission(uuid,uuid) TO service_role;

-- =====================================================================
-- (A8) v2_record_refund_submission_unknown
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_record_refund_submission_unknown(
  p_admin_actor_id uuid, p_refund_id uuid, p_http_status int, p_sanitized_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_refund record;
BEGIN
  IF p_admin_actor_id IS NULL OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;
  IF p_http_status IS NOT NULL AND (p_http_status < 100 OR p_http_status > 599) THEN
    RAISE EXCEPTION 'invalid_http_status' USING ERRCODE='22023';
  END IF;
  IF octet_length(COALESCE(p_sanitized_payload::text,'')) > 65536 THEN
    RAISE EXCEPTION 'payload_too_large' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;
  IF v_refund.provider_submission_state <> 'submitting' THEN
    RAISE EXCEPTION 'submission_state_invalid:%', v_refund.provider_submission_state USING ERRCODE='22023';
  END IF;

  UPDATE public.refunds
     SET provider_submission_state = 'submission_unknown',
         last_provider_http_status = p_http_status,
         sanitized_provider_payload = COALESCE(p_sanitized_payload, sanitized_provider_payload),
         updated_at = now()
   WHERE id = v_refund.id;

  RETURN jsonb_build_object('ok', true, 'refund_id', v_refund.id,
    'provider_submission_state','submission_unknown');
END $fn$;

REVOKE ALL ON FUNCTION public.v2_record_refund_submission_unknown(uuid,uuid,int,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_record_refund_submission_unknown(uuid,uuid,int,jsonb) TO service_role;

-- =====================================================================
-- (A9) v2_claim_refund_status_check
-- =====================================================================
CREATE OR REPLACE FUNCTION public.v2_claim_refund_status_check(
  p_admin_actor_id uuid, p_refund_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE v_refund record; v_next interval; v_delay_sec int;
BEGIN
  IF p_admin_actor_id IS NULL OR NOT public.has_role(p_admin_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_refund FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002'; END IF;

  IF v_refund.status NOT IN ('approved'::public.v2_refund_status)
     AND v_refund.provider_submission_state NOT IN ('submitted','submission_unknown') THEN
    RAISE EXCEPTION 'refund_not_pollable' USING ERRCODE='22023';
  END IF;
  IF v_refund.provider_refund_order_id IS NULL
     OR btrim(v_refund.provider_refund_order_id) = '' THEN
    RAISE EXCEPTION 'missing_provider_refund_id' USING ERRCODE='22023';
  END IF;
  IF v_refund.next_check_after IS NOT NULL AND v_refund.next_check_after > now() THEN
    RETURN jsonb_build_object('ok', false, 'error','backoff_active',
      'next_check_after', v_refund.next_check_after,
      'check_count', v_refund.check_count);
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
    'provider_refund_order_id', v_refund.provider_refund_order_id,
    'check_count', v_refund.check_count + 1,
    'next_check_after', now() + v_next);
END $fn$;

REVOKE ALL ON FUNCTION public.v2_claim_refund_status_check(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_claim_refund_status_check(uuid,uuid) TO service_role;
