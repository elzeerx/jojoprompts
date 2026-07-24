
-- =====================================================================
-- V2 Post-Purchase Receipt Delivery Pipeline
-- Durable outbox + trigger + service-only claim/complete/fail RPCs.
-- No data mutations. No historical backfill. No network calls.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Outbox table.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.v2_order_receipt_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 20),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_message_id text CHECK (provider_message_id IS NULL OR char_length(provider_message_id) <= 200),
  last_error_code text CHECK (last_error_code IS NULL OR (char_length(last_error_code) BETWEEN 1 AND 80 AND last_error_code ~ '^[A-Za-z0-9_.:-]+$')),
  last_error_message text CHECK (last_error_message IS NULL OR char_length(last_error_message) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT v2_order_receipt_deliveries_order_uniq UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS ix_v2_receipt_deliveries_status_next
  ON public.v2_order_receipt_deliveries (status, next_attempt_at)
  WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS ix_v2_receipt_deliveries_status
  ON public.v2_order_receipt_deliveries (status);

GRANT ALL ON public.v2_order_receipt_deliveries TO service_role;
-- authenticated/anon receive NO direct table grants; admin reads flow through RLS + admin check.

ALTER TABLE public.v2_order_receipt_deliveries ENABLE ROW LEVEL SECURITY;

-- Only admins (via SECURITY DEFINER helper) may SELECT rows through the JS client.
DROP POLICY IF EXISTS "admin_read_receipt_deliveries" ON public.v2_order_receipt_deliveries;
CREATE POLICY "admin_read_receipt_deliveries"
  ON public.v2_order_receipt_deliveries
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public._v2_touch_receipt_delivery_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_v2_receipt_delivery_touch ON public.v2_order_receipt_deliveries;
CREATE TRIGGER trg_v2_receipt_delivery_touch
  BEFORE UPDATE ON public.v2_order_receipt_deliveries
  FOR EACH ROW EXECUTE FUNCTION public._v2_touch_receipt_delivery_updated_at();

-- ---------------------------------------------------------------------
-- 2) Trigger on orders: enqueue exactly-once on non-paid -> paid transition.
--    No historical backfill: this fires only on UPDATE from now onward.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._v2_enqueue_order_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'paid'
     AND (OLD.status IS DISTINCT FROM 'paid') THEN
    INSERT INTO public.v2_order_receipt_deliveries (order_id)
    VALUES (NEW.id)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._v2_enqueue_order_receipt() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_v2_enqueue_order_receipt ON public.orders;
CREATE TRIGGER trg_v2_enqueue_order_receipt
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid'))
  EXECUTE FUNCTION public._v2_enqueue_order_receipt();

-- ---------------------------------------------------------------------
-- 3) Service-only claim RPC. Also self-heals a missing pending row when
--    the specified order is already paid, so verified status re-checks
--    can recover a missed trigger without duplicating sends.
--    Uses FOR UPDATE SKIP LOCKED for concurrency safety.
-- ---------------------------------------------------------------------
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
DECLARE
  v_row public.v2_order_receipt_deliveries%ROWTYPE;
  v_order_status text;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE='22023';
  END IF;

  SELECT o.status::text INTO v_order_status
    FROM public.orders o WHERE o.id = p_order_id;
  IF v_order_status IS NULL THEN
    RETURN;
  END IF;

  -- Repair path: no delivery row yet but order is paid -> enqueue.
  IF NOT EXISTS (SELECT 1 FROM public.v2_order_receipt_deliveries d WHERE d.order_id = p_order_id) THEN
    IF v_order_status = 'paid' THEN
      INSERT INTO public.v2_order_receipt_deliveries (order_id)
      VALUES (p_order_id)
      ON CONFLICT (order_id) DO NOTHING;
    ELSE
      RETURN;
    END IF;
  END IF;

  -- Atomically claim if eligible.
  SELECT * INTO v_row FROM public.v2_order_receipt_deliveries
    WHERE order_id = p_order_id
    FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    -- Another worker holds the lock: report not claimed but return the row shape.
    SELECT * INTO v_row FROM public.v2_order_receipt_deliveries WHERE order_id = p_order_id;
    RETURN QUERY SELECT v_row.id, v_row.order_id, v_row.attempts, v_row.max_attempts, false;
    RETURN;
  END IF;

  IF v_row.status = 'sent' THEN
    RETURN QUERY SELECT v_row.id, v_row.order_id, v_row.attempts, v_row.max_attempts, false;
    RETURN;
  END IF;

  IF v_row.status = 'processing' THEN
    RETURN QUERY SELECT v_row.id, v_row.order_id, v_row.attempts, v_row.max_attempts, false;
    RETURN;
  END IF;

  IF v_row.status = 'failed' AND v_row.attempts >= v_row.max_attempts THEN
    RETURN QUERY SELECT v_row.id, v_row.order_id, v_row.attempts, v_row.max_attempts, false;
    RETURN;
  END IF;

  IF v_row.next_attempt_at > now() THEN
    RETURN QUERY SELECT v_row.id, v_row.order_id, v_row.attempts, v_row.max_attempts, false;
    RETURN;
  END IF;

  UPDATE public.v2_order_receipt_deliveries
    SET status = 'processing',
        attempts = attempts + 1,
        claimed_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;

  RETURN QUERY SELECT v_row.id, v_row.order_id, v_row.attempts, v_row.max_attempts, true;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_claim_order_receipt_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_claim_order_receipt_delivery(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- 4) Complete RPC.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_complete_order_receipt_delivery(
  p_delivery_id uuid,
  p_provider_message_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_msg text;
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
      AND status <> 'sent';
END;
$$;
REVOKE ALL ON FUNCTION public.v2_complete_order_receipt_delivery(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_complete_order_receipt_delivery(uuid, text) TO service_role;

-- ---------------------------------------------------------------------
-- 5) Fail RPC with exponential backoff (60s * 2^(attempts-1), capped 1h).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_fail_order_receipt_delivery(
  p_delivery_id uuid,
  p_error_code text,
  p_error_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.v2_order_receipt_deliveries%ROWTYPE;
  v_code text;
  v_message text;
  v_backoff_seconds integer;
  v_final_status text;
  v_next_at timestamptz;
BEGIN
  IF p_delivery_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_row FROM public.v2_order_receipt_deliveries
    WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_row.status = 'sent' THEN
    RETURN;
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
  v_final_status := 'failed';

  UPDATE public.v2_order_receipt_deliveries
    SET status = v_final_status,
        last_error_code = v_code,
        last_error_message = v_message,
        next_attempt_at = v_next_at
    WHERE id = p_delivery_id;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_fail_order_receipt_delivery(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_fail_order_receipt_delivery(uuid, text, text) TO service_role;
