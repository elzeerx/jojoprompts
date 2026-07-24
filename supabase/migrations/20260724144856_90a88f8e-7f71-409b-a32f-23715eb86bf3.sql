-- ============================================================================
-- Phase 6C receipt hardening: stale-lease reclaim, tightened transitions,
-- successful-log uniqueness. Forward-only. No data backfill.
-- ============================================================================

-- 1) Recovery index for stale-lease scans.
CREATE INDEX IF NOT EXISTS idx_v2_receipt_deliveries_processing_claimed_at
  ON public.v2_order_receipt_deliveries (claimed_at)
  WHERE status = 'processing';

-- 2) Claim RPC: allow reclaim of stale 'processing' rows (lease > 10 minutes)
--    when attempts are still below max_attempts.
CREATE OR REPLACE FUNCTION public.v2_claim_order_receipt_delivery(p_order_id uuid)
RETURNS TABLE (
  delivery_id uuid,
  order_id uuid,
  attempts integer,
  max_attempts integer,
  claimed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_row public.v2_order_receipt_deliveries%ROWTYPE;
  v_order_status text;
  v_stale_before timestamptz := now() - interval '10 minutes';
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE='22023';
  END IF;

  SELECT o.status::text INTO v_order_status
    FROM public.orders o WHERE o.id = p_order_id;
  IF v_order_status IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.v2_order_receipt_deliveries d WHERE d.order_id = p_order_id) THEN
    IF v_order_status = 'paid' THEN
      INSERT INTO public.v2_order_receipt_deliveries (order_id)
      VALUES (p_order_id)
      ON CONFLICT (order_id) DO NOTHING;
    ELSE
      RETURN;
    END IF;
  END IF;

  SELECT d.* INTO v_row FROM public.v2_order_receipt_deliveries d
    WHERE d.order_id = p_order_id
    FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    SELECT d.* INTO v_row FROM public.v2_order_receipt_deliveries d WHERE d.order_id = p_order_id;
    delivery_id := v_row.id;
    order_id    := v_row.order_id;
    attempts    := v_row.attempts;
    max_attempts:= v_row.max_attempts;
    claimed     := false;
    RETURN NEXT; RETURN;
  END IF;

  -- Non-claimable terminal / not-yet-due states.
  IF v_row.status = 'sent'
     OR (v_row.status = 'failed' AND v_row.attempts >= v_row.max_attempts)
     OR (v_row.status <> 'processing' AND v_row.next_attempt_at > now())
  THEN
    delivery_id := v_row.id;
    order_id    := v_row.order_id;
    attempts    := v_row.attempts;
    max_attempts:= v_row.max_attempts;
    claimed     := false;
    RETURN NEXT; RETURN;
  END IF;

  -- Fresh processing row (lease still valid) OR stale but attempts exhausted → not claimable.
  IF v_row.status = 'processing' THEN
    IF v_row.claimed_at IS NULL
       OR v_row.claimed_at > v_stale_before
       OR v_row.attempts >= v_row.max_attempts
    THEN
      delivery_id := v_row.id;
      order_id    := v_row.order_id;
      attempts    := v_row.attempts;
      max_attempts:= v_row.max_attempts;
      claimed     := false;
      RETURN NEXT; RETURN;
    END IF;
    -- else: fall through to claim (reclaim of stale lease)
  END IF;

  UPDATE public.v2_order_receipt_deliveries d
    SET status = 'processing',
        attempts = d.attempts + 1,
        claimed_at = now()
    WHERE d.id = v_row.id
    RETURNING d.* INTO v_row;

  delivery_id := v_row.id;
  order_id    := v_row.order_id;
  attempts    := v_row.attempts;
  max_attempts:= v_row.max_attempts;
  claimed     := true;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_claim_order_receipt_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_claim_order_receipt_delivery(uuid) TO service_role;

-- 3) Complete RPC returns boolean; only transitions a legitimately processing row.
DROP FUNCTION IF EXISTS public.v2_complete_order_receipt_delivery(uuid, text);
CREATE OR REPLACE FUNCTION public.v2_complete_order_receipt_delivery(
  p_delivery_id uuid,
  p_provider_message_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_msg text;
  v_updated integer;
BEGIN
  IF p_delivery_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE='22023';
  END IF;
  v_msg := NULLIF(btrim(coalesce(p_provider_message_id, '')), '');
  IF v_msg IS NOT NULL AND char_length(v_msg) > 200 THEN
    v_msg := left(v_msg, 200);
  END IF;

  UPDATE public.v2_order_receipt_deliveries
    SET status = 'sent',
        sent_at = now(),
        provider_message_id = v_msg,
        last_error_code = NULL,
        last_error_message = NULL,
        next_attempt_at = now()
    WHERE id = p_delivery_id
      AND status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_complete_order_receipt_delivery(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_complete_order_receipt_delivery(uuid, text) TO service_role;

-- 4) Fail RPC returns boolean; never overwrites 'sent'; only transitions 'processing'.
DROP FUNCTION IF EXISTS public.v2_fail_order_receipt_delivery(uuid, text, text);
CREATE OR REPLACE FUNCTION public.v2_fail_order_receipt_delivery(
  p_delivery_id uuid,
  p_error_code text,
  p_error_message text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.v2_order_receipt_deliveries%ROWTYPE;
  v_code text;
  v_message text;
  v_backoff_seconds integer;
  v_next_at timestamptz;
  v_updated integer;
BEGIN
  IF p_delivery_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_row FROM public.v2_order_receipt_deliveries
    WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_row.status <> 'processing' THEN
    RETURN false;
  END IF;

  v_code := NULLIF(btrim(coalesce(p_error_code, '')), '');
  IF v_code IS NOT NULL AND (v_code !~ '^[A-Za-z0-9_.:-]+$' OR char_length(v_code) > 80) THEN
    v_code := 'invalid_error_code';
  END IF;
  v_message := NULLIF(btrim(coalesce(p_error_message, '')), '');
  IF v_message IS NOT NULL AND char_length(v_message) > 500 THEN
    v_message := left(v_message, 500);
  END IF;

  v_backoff_seconds := least(3600, 60 * (2 ^ greatest(v_row.attempts - 1, 0))::integer);
  v_next_at := now() + make_interval(secs => v_backoff_seconds);

  UPDATE public.v2_order_receipt_deliveries
    SET status = 'failed',
        last_error_code = v_code,
        last_error_message = v_message,
        next_attempt_at = v_next_at
    WHERE id = p_delivery_id
      AND status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_fail_order_receipt_delivery(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_fail_order_receipt_delivery(uuid, text, text) TO service_role;

-- 5) Partial unique index guaranteeing at most one successful v2 receipt log per order.
--    Currently zero rows of this type exist, so no dedup required.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_email_logs_v2_receipt_success_order
  ON public.email_logs ((response_metadata->>'order_id'))
  WHERE email_type = 'v2_order_receipt'
    AND success = true
    AND response_metadata ? 'order_id';
