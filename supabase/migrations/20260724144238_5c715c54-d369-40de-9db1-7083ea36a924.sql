
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
    delivery_id := v_row.id; order_id := v_row.order_id;
    attempts := v_row.attempts; max_attempts := v_row.max_attempts; claimed := false;
    RETURN NEXT; RETURN;
  END IF;

  IF v_row.status = 'sent' OR v_row.status = 'processing'
     OR (v_row.status = 'failed' AND v_row.attempts >= v_row.max_attempts)
     OR v_row.next_attempt_at > now() THEN
    delivery_id := v_row.id; order_id := v_row.order_id;
    attempts := v_row.attempts; max_attempts := v_row.max_attempts; claimed := false;
    RETURN NEXT; RETURN;
  END IF;

  UPDATE public.v2_order_receipt_deliveries d
    SET status = 'processing',
        attempts = d.attempts + 1,
        claimed_at = now()
    WHERE d.id = v_row.id
    RETURNING d.* INTO v_row;

  delivery_id := v_row.id; order_id := v_row.order_id;
  attempts := v_row.attempts; max_attempts := v_row.max_attempts; claimed := true;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.v2_claim_order_receipt_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_claim_order_receipt_delivery(uuid) TO service_role;
