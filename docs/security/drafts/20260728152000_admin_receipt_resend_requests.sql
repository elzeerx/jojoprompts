-- DRAFT (source-only, awaiting promotion): admin receipt-resend requests.
--
-- Target filename after promotion:
--   supabase/migrations/20260728152000_admin_receipt_resend_requests.sql
--
-- Design rationale (see docs/security/RECEIPT_RESEND_BLOCKER.md):
-- The original v2_order_receipt_deliveries row is a single-shot claim/complete
-- state machine and its Resend idempotency key is derived from the order id.
-- Reusing or reopening that row would fight Resend's provider-side dedup and
-- would race the original delivery task. Instead each admin-requested resend
-- gets its own audited request row with a DISTINCT deterministic idempotency
-- key (v2-order-receipt-resend/{request_id}), and every state transition is
-- gated by service-role-only SECURITY DEFINER RPCs. The original row and the
-- shared receipt pipeline remain UNTOUCHED.

CREATE TABLE public.v2_order_receipt_resend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  requested_by uuid,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','failed')),
  provider_message_id text,
  error_code text,
  error_message text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reason_bounded
    CHECK (char_length(reason) BETWEEN 3 AND 300),
  CONSTRAINT error_code_bounded
    CHECK (error_code IS NULL OR char_length(error_code) BETWEEN 1 AND 80),
  CONSTRAINT error_message_bounded
    CHECK (error_message IS NULL OR char_length(error_message) BETWEEN 1 AND 500),
  CONSTRAINT provider_msg_bounded
    CHECK (provider_message_id IS NULL OR char_length(provider_message_id) BETWEEN 1 AND 200)
);

GRANT SELECT ON public.v2_order_receipt_resend_requests TO authenticated;
GRANT ALL ON public.v2_order_receipt_resend_requests TO service_role;

ALTER TABLE public.v2_order_receipt_resend_requests ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated admins. No INSERT/UPDATE/DELETE policies:
-- only service_role (via SECURITY DEFINER RPCs) mutates the table.
CREATE POLICY admin_read_receipt_resend_requests
  ON public.v2_order_receipt_resend_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_v2_receipt_resend_order_time
  ON public.v2_order_receipt_resend_requests (order_id, requested_at DESC);

CREATE INDEX idx_v2_receipt_resend_status_time
  ON public.v2_order_receipt_resend_requests (status, requested_at DESC);

-- At most one active (pending or processing) request per order.
CREATE UNIQUE INDEX uniq_v2_receipt_resend_active
  ON public.v2_order_receipt_resend_requests (order_id)
  WHERE status IN ('pending','processing');

CREATE OR REPLACE FUNCTION public._v2_touch_receipt_resend_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_v2_receipt_resend_updated_at
BEFORE UPDATE ON public.v2_order_receipt_resend_requests
FOR EACH ROW EXECUTE FUNCTION public._v2_touch_receipt_resend_updated_at();

-- ------------------------------------------------------------------
-- (a) Create request. Service-role only.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_internal_create_receipt_resend_request(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_reason                text;
  v_order_status          text;
  v_user_id               uuid;
  v_email                 text;
  v_request_id            uuid;
  v_last_sent             timestamptz;
  v_last_resend_requested timestamptz;
  v_recent_order_count    integer;
  v_recent_admin_count    integer;
  v_is_admin              boolean;
BEGIN
  IF p_order_id IS NULL OR p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  v_reason := btrim(p_reason);
  IF char_length(v_reason) < 3 OR char_length(v_reason) > 300 THEN
    RAISE EXCEPTION 'reason_invalid_length' USING ERRCODE = '22023';
  END IF;

  SELECT public.has_role(p_admin_user_id, 'admin'::public.app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT status, user_id
    INTO v_order_status, v_user_id
    FROM public.orders
   WHERE id = p_order_id;
  IF v_order_status IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_order_status NOT IN ('paid','partially_refunded') THEN
    RAISE EXCEPTION 'order_not_eligible' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_recipient' USING ERRCODE = '22023';
  END IF;
  SELECT email INTO v_email FROM public.profiles WHERE id = v_user_id;
  IF v_email IS NULL OR btrim(v_email) = '' THEN
    RAISE EXCEPTION 'missing_recipient' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.v2_order_receipt_resend_requests
     WHERE order_id = p_order_id AND status IN ('pending','processing')
  ) THEN
    RAISE EXCEPTION 'pending_exists' USING ERRCODE = '23505';
  END IF;

  SELECT sent_at INTO v_last_sent
    FROM public.v2_order_receipt_deliveries
   WHERE order_id = p_order_id;

  SELECT max(requested_at) INTO v_last_resend_requested
    FROM public.v2_order_receipt_resend_requests
   WHERE order_id = p_order_id;

  IF GREATEST(
       COALESCE(v_last_sent,             'epoch'::timestamptz),
       COALESCE(v_last_resend_requested, 'epoch'::timestamptz)
     ) > now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'cooldown_active' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_recent_order_count
    FROM public.v2_order_receipt_resend_requests
   WHERE order_id = p_order_id
     AND requested_at > now() - interval '24 hours';
  IF v_recent_order_count >= 5 THEN
    RAISE EXCEPTION 'order_cap_exceeded' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_recent_admin_count
    FROM public.v2_order_receipt_resend_requests
   WHERE requested_by = p_admin_user_id
     AND requested_at > now() - interval '24 hours';
  IF v_recent_admin_count >= 50 THEN
    RAISE EXCEPTION 'admin_cap_exceeded' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.v2_order_receipt_resend_requests
    (order_id, requested_by, reason, status)
  VALUES (p_order_id, p_admin_user_id, v_reason, 'pending')
  RETURNING id INTO v_request_id;

  -- Safe audit metadata only. No email, no amount, no items, no provider payload.
  INSERT INTO public.activity_events (actor_type, entity_type, entity_id, action, metadata)
  VALUES ('admin', 'order', p_order_id, 'order_receipt_resend_requested',
          jsonb_build_object('request_id', v_request_id, 'status', 'pending'));

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_create_receipt_resend_request(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_internal_create_receipt_resend_request(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_create_receipt_resend_request(uuid, uuid, text) TO service_role;

-- ------------------------------------------------------------------
-- (b) Atomic claim pending -> processing. Service-role only.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_internal_claim_receipt_resend_request(
  p_request_id uuid
) RETURNS TABLE(order_id uuid, requested_by uuid, claimed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_row public.v2_order_receipt_resend_requests%ROWTYPE;
BEGIN
  IF p_request_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  SELECT * INTO v_row
    FROM public.v2_order_receipt_resend_requests
   WHERE id = p_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  IF v_row.status <> 'pending' THEN
    RETURN QUERY SELECT v_row.order_id, v_row.requested_by, false;
    RETURN;
  END IF;

  UPDATE public.v2_order_receipt_resend_requests
     SET status = 'processing', started_at = now()
   WHERE id = p_request_id;

  RETURN QUERY SELECT v_row.order_id, v_row.requested_by, true;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_claim_receipt_resend_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_internal_claim_receipt_resend_request(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_claim_receipt_resend_request(uuid) TO service_role;

-- ------------------------------------------------------------------
-- (c) Complete processing -> sent. Service-role only.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_internal_complete_receipt_resend_request(
  p_request_id uuid,
  p_provider_message_id text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_pmid  text;
  v_order uuid;
BEGIN
  IF p_request_id IS NULL THEN RETURN false; END IF;
  v_pmid := CASE
    WHEN p_provider_message_id IS NULL THEN NULL
    ELSE substr(btrim(p_provider_message_id), 1, 200)
  END;
  IF v_pmid = '' THEN v_pmid := NULL; END IF;

  UPDATE public.v2_order_receipt_resend_requests
     SET status = 'sent',
         provider_message_id = v_pmid,
         completed_at = now()
   WHERE id = p_request_id AND status = 'processing'
   RETURNING order_id INTO v_order;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.activity_events (actor_type, entity_type, entity_id, action, metadata)
  VALUES ('admin', 'order', v_order, 'order_receipt_resend_sent',
          jsonb_build_object('request_id', p_request_id, 'status', 'sent'));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_complete_receipt_resend_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_internal_complete_receipt_resend_request(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_complete_receipt_resend_request(uuid, text) TO service_role;

-- ------------------------------------------------------------------
-- (d) Fail processing -> failed. Service-role only.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_internal_fail_receipt_resend_request(
  p_request_id uuid,
  p_error_code text,
  p_error_message text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_code  text;
  v_msg   text;
  v_order uuid;
BEGIN
  IF p_request_id IS NULL THEN RETURN false; END IF;
  v_code := COALESCE(NULLIF(btrim(COALESCE(p_error_code, '')), ''), 'unknown');
  IF v_code !~ '^[A-Za-z0-9_.:-]{1,80}$' THEN
    v_code := 'invalid_error_code';
  END IF;
  v_msg := substr(
    COALESCE(NULLIF(btrim(COALESCE(p_error_message, '')), ''), 'unknown_error'),
    1, 500
  );

  UPDATE public.v2_order_receipt_resend_requests
     SET status = 'failed',
         error_code = v_code,
         error_message = v_msg,
         completed_at = now()
   WHERE id = p_request_id AND status = 'processing'
   RETURNING order_id INTO v_order;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.activity_events (actor_type, entity_type, entity_id, action, metadata)
  VALUES ('admin', 'order', v_order, 'order_receipt_resend_failed',
          jsonb_build_object('request_id', p_request_id, 'status', 'failed', 'error_code', v_code));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_fail_receipt_resend_request(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_internal_fail_receipt_resend_request(uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_fail_receipt_resend_request(uuid, text, text) TO service_role;
