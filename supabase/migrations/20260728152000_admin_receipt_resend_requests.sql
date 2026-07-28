-- Admin receipt-resend requests: separate audited resend model.
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
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','reconciliation_required','sent','failed')),
  provider_message_id text,
  error_code text,
  error_message text,
  reconciliation_attempts integer NOT NULL DEFAULT 0
    CHECK (reconciliation_attempts BETWEEN 0 AND 5),
  last_reconciliation_at timestamptz,
  manual_resolution_note text
    CHECK (
      manual_resolution_note IS NULL
      OR (
        char_length(manual_resolution_note) BETWEEN 3 AND 300
        AND octet_length(manual_resolution_note) <= 1200
      )
    ),
  manual_resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  manual_resolved_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reason_bounded
    CHECK (char_length(reason) BETWEEN 3 AND 300 AND octet_length(reason) <= 1200),
  CONSTRAINT error_code_bounded
    CHECK (error_code IS NULL OR char_length(error_code) BETWEEN 1 AND 80),
  CONSTRAINT error_message_bounded
    CHECK (
      error_message IS NULL
      OR (char_length(error_message) BETWEEN 1 AND 500 AND octet_length(error_message) <= 2000)
    ),
  CONSTRAINT provider_msg_bounded
    CHECK (provider_message_id IS NULL OR char_length(provider_message_id) BETWEEN 1 AND 200)
);

REVOKE ALL ON TABLE public.v2_order_receipt_resend_requests
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v2_order_receipt_resend_requests TO authenticated;
GRANT ALL ON public.v2_order_receipt_resend_requests TO service_role;

ALTER TABLE public.v2_order_receipt_resend_requests ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated admins. No INSERT/UPDATE/DELETE policies:
-- only service_role (via SECURITY DEFINER RPCs) mutates the table.
CREATE POLICY admin_read_receipt_resend_requests
  ON public.v2_order_receipt_resend_requests
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(
      (SELECT auth.uid()),
      'admin'::public.app_role
    )
  );

CREATE INDEX idx_v2_receipt_resend_order_time
  ON public.v2_order_receipt_resend_requests (order_id, requested_at DESC);

CREATE INDEX idx_v2_receipt_resend_status_time
  ON public.v2_order_receipt_resend_requests (status, requested_at DESC);

-- At most one active request per order, including an ambiguous request that
-- must be reconciled with the same provider idempotency key.
CREATE UNIQUE INDEX uniq_v2_receipt_resend_active
  ON public.v2_order_receipt_resend_requests (order_id)
  WHERE status IN ('pending','processing','reconciliation_required');

-- Exact provider payload snapshot used only for a same-key reconciliation.
-- This table intentionally has no authenticated grant or policy: its PII and
-- rendered receipt body are service-role-only and are never returned to the UI.
CREATE TABLE public.v2_order_receipt_resend_payloads (
  request_id uuid PRIMARY KEY
    REFERENCES public.v2_order_receipt_resend_requests(id) ON DELETE CASCADE,
  from_header text NOT NULL
    CHECK (char_length(from_header) BETWEEN 1 AND 500),
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email text NOT NULL
    CHECK (char_length(recipient_email) BETWEEN 3 AND 320),
  reply_to text NOT NULL
    CHECK (char_length(reply_to) BETWEEN 3 AND 320),
  subject text NOT NULL
    CHECK (char_length(subject) BETWEEN 1 AND 500),
  html_body text NOT NULL
    CHECK (octet_length(html_body) BETWEEN 1 AND 512000),
  text_body text NOT NULL
    CHECK (octet_length(text_body) BETWEEN 1 AND 100000),
  provider_headers jsonb NOT NULL
    CHECK (jsonb_typeof(provider_headers) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.v2_order_receipt_resend_payloads
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.v2_order_receipt_resend_payloads TO service_role;
ALTER TABLE public.v2_order_receipt_resend_payloads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._v2_touch_receipt_resend_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._v2_touch_receipt_resend_updated_at()
  FROM PUBLIC, anon, authenticated;

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

  v_reason := regexp_replace(btrim(p_reason), '[[:space:]]+', ' ', 'g');
  IF char_length(v_reason) < 3
     OR char_length(v_reason) > 300
     OR octet_length(v_reason) > 1200 THEN
    RAISE EXCEPTION 'reason_invalid_length' USING ERRCODE = '22023';
  END IF;

  SELECT public.has_role(p_admin_user_id, 'admin'::public.app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Serialize all checks for this order and this admin. The row lock keeps
  -- eligibility stable while the advisory locks make the rolling caps exact
  -- even when the same admin submits requests for different orders.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('v2-receipt-resend-order:' || p_order_id::text, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('v2-receipt-resend-admin:' || p_admin_user_id::text, 0)
  );

  SELECT status, user_id
    INTO v_order_status, v_user_id
    FROM public.orders
   WHERE id = p_order_id
   FOR UPDATE;
  IF NOT FOUND THEN
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
     WHERE order_id = p_order_id
       AND status IN ('pending','processing','reconciliation_required')
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
  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  )
  VALUES (p_admin_user_id, 'admin', 'order', p_order_id, 'order_receipt_resend_requested',
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
-- (c) Mark an ambiguous provider result for same-key reconciliation.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_internal_require_receipt_resend_reconciliation(
  p_request_id uuid,
  p_error_code text,
  p_error_message text,
  p_provider_message_id text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_code  text;
  v_msg   text;
  v_pmid  text;
  v_order uuid;
  v_actor uuid;
BEGIN
  IF p_request_id IS NULL THEN RETURN false; END IF;
  v_code := COALESCE(NULLIF(btrim(COALESCE(p_error_code, '')), ''), 'reconciliation_required');
  IF v_code !~ '^[A-Za-z0-9_.:-]{1,80}$' THEN
    v_code := 'reconciliation_required';
  END IF;
  v_msg := substr(
    COALESCE(NULLIF(btrim(COALESCE(p_error_message, '')), ''), 'provider_outcome_unknown'),
    1, 500
  );
  v_pmid := CASE
    WHEN p_provider_message_id IS NULL THEN NULL
    ELSE substr(btrim(p_provider_message_id), 1, 200)
  END;
  IF v_pmid = '' THEN v_pmid := NULL; END IF;

  UPDATE public.v2_order_receipt_resend_requests
     SET status = 'reconciliation_required',
         provider_message_id = COALESCE(v_pmid, provider_message_id),
         error_code = v_code,
         error_message = v_msg
   WHERE id = p_request_id AND status = 'processing'
   RETURNING order_id, requested_by INTO v_order, v_actor;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  )
  VALUES (v_actor, 'admin', 'order', v_order, 'order_receipt_resend_reconciliation_required',
          jsonb_build_object('request_id', p_request_id, 'status', 'reconciliation_required'));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_require_receipt_resend_reconciliation(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_require_receipt_resend_reconciliation(uuid, text, text, text)
  TO service_role;

-- ------------------------------------------------------------------
-- (d) Claim reconciliation with the same request id and idempotency key.
-- A stale `processing` row is also recoverable after two minutes in case the
-- transition to reconciliation_required itself failed. Resend retains keys
-- for 24 hours; the 23-hour window leaves safety margin.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_internal_claim_receipt_resend_reconciliation(
  p_request_id uuid,
  p_admin_user_id uuid
) RETURNS TABLE(
  order_id uuid,
  requested_by uuid,
  claimed boolean,
  claim_error_code text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_row public.v2_order_receipt_resend_requests%ROWTYPE;
  v_is_admin boolean;
BEGIN
  IF p_request_id IS NULL OR p_admin_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'invalid_arguments'::text;
    RETURN;
  END IF;

  SELECT public.has_role(p_admin_user_id, 'admin'::public.app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'forbidden'::text;
    RETURN;
  END IF;

  SELECT * INTO v_row
    FROM public.v2_order_receipt_resend_requests
   WHERE id = p_request_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'request_not_found'::text;
    RETURN;
  END IF;
  IF v_row.requested_at <= now() - interval '23 hours' THEN
    RETURN QUERY SELECT v_row.order_id, v_row.requested_by, false,
      'reconciliation_window_expired'::text;
    RETURN;
  END IF;
  IF v_row.reconciliation_attempts >= 5 THEN
    RETURN QUERY SELECT v_row.order_id, v_row.requested_by, false,
      'reconciliation_attempt_cap_exceeded'::text;
    RETURN;
  END IF;
  IF v_row.status = 'processing'
     AND v_row.updated_at > now() - interval '2 minutes' THEN
    RETURN QUERY SELECT v_row.order_id, v_row.requested_by, false,
      'request_still_processing'::text;
    RETURN;
  END IF;
  IF v_row.status NOT IN ('processing','reconciliation_required') THEN
    RETURN QUERY SELECT v_row.order_id, v_row.requested_by, false,
      'reconciliation_not_required'::text;
    RETURN;
  END IF;

  UPDATE public.v2_order_receipt_resend_requests
     SET status = 'processing',
         reconciliation_attempts = reconciliation_attempts + 1,
         last_reconciliation_at = now(),
         error_code = NULL,
         error_message = NULL
   WHERE id = p_request_id;

  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  )
  VALUES (p_admin_user_id, 'admin', 'order', v_row.order_id,
          'order_receipt_resend_reconciliation_started',
          jsonb_build_object(
            'request_id', p_request_id,
            'status', 'processing',
            'attempt', v_row.reconciliation_attempts + 1
          ));

  RETURN QUERY SELECT v_row.order_id, v_row.requested_by, true, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_claim_receipt_resend_reconciliation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_claim_receipt_resend_reconciliation(uuid, uuid)
  TO service_role;

-- ------------------------------------------------------------------
-- (e) Resolve an ambiguous delivery after explicit provider review.
-- This is the only way to close a request once the 23-hour automatic retry
-- window or retry cap has been reached.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_internal_resolve_receipt_resend_reconciliation(
  p_request_id uuid,
  p_admin_user_id uuid,
  p_resolution text,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_row       public.v2_order_receipt_resend_requests%ROWTYPE;
  v_is_admin  boolean;
  v_reason    text;
  v_status    text;
BEGIN
  IF p_request_id IS NULL OR p_admin_user_id IS NULL THEN RETURN false; END IF;
  IF p_resolution NOT IN ('sent','failed') THEN RETURN false; END IF;
  v_reason := regexp_replace(btrim(COALESCE(p_reason, '')), '[[:space:]]+', ' ', 'g');
  IF char_length(v_reason) < 3
     OR char_length(v_reason) > 300
     OR octet_length(v_reason) > 1200 THEN
    RETURN false;
  END IF;

  SELECT public.has_role(p_admin_user_id, 'admin'::public.app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN RETURN false; END IF;

  SELECT * INTO v_row
    FROM public.v2_order_receipt_resend_requests
   WHERE id = p_request_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- A stale processing row is reviewable if the transition to
  -- reconciliation_required itself failed. Never resolve a live provider call.
  IF v_row.status = 'processing'
     AND v_row.updated_at > now() - interval '2 minutes' THEN
    RETURN false;
  END IF;
  IF v_row.status NOT IN ('processing','reconciliation_required') THEN
    RETURN false;
  END IF;

  v_status := p_resolution;
  UPDATE public.v2_order_receipt_resend_requests
     SET status = v_status,
         error_code = CASE
           WHEN p_resolution = 'failed' THEN 'manual_provider_review_failed'
           ELSE NULL
         END,
         error_message = CASE
           WHEN p_resolution = 'failed' THEN v_reason
           ELSE NULL
         END,
         manual_resolution_note = v_reason,
         manual_resolved_by = p_admin_user_id,
         manual_resolved_at = now(),
         completed_at = now()
   WHERE id = p_request_id;

  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  )
  VALUES (
    p_admin_user_id,
    'admin',
    'order',
    v_row.order_id,
    'order_receipt_resend_manually_resolved',
    jsonb_build_object(
      'request_id', p_request_id,
      'status', v_status,
      'resolution', p_resolution
    )
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_resolve_receipt_resend_reconciliation(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_resolve_receipt_resend_reconciliation(uuid, uuid, text, text)
  TO service_role;

-- ------------------------------------------------------------------
-- (f) Complete processing -> sent. Service-role only.
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
  v_actor uuid;
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
   RETURNING order_id, requested_by INTO v_order, v_actor;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  )
  VALUES (v_actor, 'admin', 'order', v_order, 'order_receipt_resend_sent',
          jsonb_build_object('request_id', p_request_id, 'status', 'sent'));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_complete_receipt_resend_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_internal_complete_receipt_resend_request(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_complete_receipt_resend_request(uuid, text) TO service_role;

-- ------------------------------------------------------------------
-- (g) Fail pending/processing -> failed. Service-role only.
-- Allowing pending here lets the Edge Function close a request when the claim
-- RPC itself fails before any provider call. Allowing processing preserves the
-- normal definitive pre-send/provider-rejection failure path.
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
  v_actor uuid;
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
   WHERE id = p_request_id AND status IN ('pending','processing')
   RETURNING order_id, requested_by INTO v_order, v_actor;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.activity_events (
    actor_user_id, actor_type, entity_type, entity_id, action, metadata
  )
  VALUES (v_actor, 'admin', 'order', v_order, 'order_receipt_resend_failed',
          jsonb_build_object('request_id', p_request_id, 'status', 'failed'));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_fail_receipt_resend_request(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_internal_fail_receipt_resend_request(uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_fail_receipt_resend_request(uuid, text, text) TO service_role;
