-- Recovery RPC for definite provider 4xx rejection of a refund create call.
--
-- Context: v2-upayments-refund optimistically claims a pending refund and
-- POSTs to UPayments /create-refund. If the network or provider response is
-- ambiguous (timeouts, 5xx, invalid_response, etc.) the refund transitions
-- to provider_submission_state='submission_unknown' so no automated retry
-- can double-submit. When an operator has EXTERNALLY VERIFIED via GET
-- /check-refund/{orderId} that the provider created no refund AND the
-- original submission failed with a DEFINITE 4xx (client-error) status —
-- e.g. HTTP 422 for a malformed body — it is safe to rearm the submission
-- so a corrected client can re-attempt.
--
-- IMPORTANT: This RPC MUST NOT be used for:
--   * network errors, DNS failures, connection resets
--   * HTTP 5xx responses (server may have accepted the refund)
--   * timeouts (submission_unknown is the correct terminal state)
--   * any case where /check-refund/{orderId} was not consulted or is unclear
-- Using it in those cases risks double-refunding the customer.
--
-- Fail-closed contract:
--   * caller must be an admin (has_role(_, 'admin'))
--   * refund must exist and be locked FOR UPDATE
--   * status must equal 'pending'
--   * provider_submission_state must equal 'submission_unknown'
--   * last_provider_http_status must equal p_expected_http_status AND
--     be in the 400..499 range
--   * provider_reference and provider_refund_order_id must both be NULL
--     (no provider-side refund record exists locally)
-- If any precondition fails the RPC raises and no state is mutated.
-- On success, only provider_submission_state (→ 'not_started'),
-- provider_submission_started_at (→ NULL) and updated_at are reset.
-- No IDs are embedded; the RPC is generic and per-refund/per-call.

CREATE OR REPLACE FUNCTION public.v2_rearm_rejected_refund_submission(
  p_admin_actor_id uuid,
  p_refund_id uuid,
  p_expected_http_status integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row public.refunds%ROWTYPE;
BEGIN
  IF p_admin_actor_id IS NULL OR p_refund_id IS NULL OR p_expected_http_status IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments';
  END IF;

  IF NOT public.has_role(p_admin_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'insufficient_permissions';
  END IF;

  IF p_expected_http_status < 400 OR p_expected_http_status > 499 THEN
    RAISE EXCEPTION 'expected_http_status_out_of_range';
  END IF;

  SELECT * INTO v_row
  FROM public.refunds
  WHERE id = p_refund_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund_not_found';
  END IF;

  IF v_row.status IS DISTINCT FROM 'pending'::public.v2_refund_status THEN
    RAISE EXCEPTION 'refund_status_not_pending';
  END IF;

  IF v_row.provider_submission_state IS DISTINCT FROM 'submission_unknown' THEN
    RAISE EXCEPTION 'submission_state_not_unknown';
  END IF;

  IF v_row.last_provider_http_status IS NULL
     OR v_row.last_provider_http_status <> p_expected_http_status THEN
    RAISE EXCEPTION 'http_status_mismatch';
  END IF;

  IF v_row.last_provider_http_status < 400 OR v_row.last_provider_http_status > 499 THEN
    RAISE EXCEPTION 'last_http_status_not_client_error';
  END IF;

  IF v_row.provider_reference IS NOT NULL
     OR v_row.provider_refund_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'provider_refund_present';
  END IF;

  UPDATE public.refunds
  SET provider_submission_state = 'not_started',
      provider_submission_started_at = NULL,
      updated_at = now()
  WHERE id = p_refund_id;

  RETURN jsonb_build_object(
    'refund_id', p_refund_id,
    'rearmed', true,
    'previous_http_status', v_row.last_provider_http_status
  );
END;
$$;

COMMENT ON FUNCTION public.v2_rearm_rejected_refund_submission(uuid, uuid, integer) IS
  'Admin-only recovery for a refund left in provider_submission_state=submission_unknown after '
  'a DEFINITE provider 4xx rejection (e.g. HTTP 422 for malformed body). Requires the operator '
  'to have externally verified via GET /check-refund/{orderId} that no provider refund exists. '
  'MUST NOT be used for network errors, timeouts, or 5xx — those may indicate the provider '
  'accepted the refund and rearming would risk double-refunding the customer.';

REVOKE ALL ON FUNCTION public.v2_rearm_rejected_refund_submission(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_rearm_rejected_refund_submission(uuid, uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.v2_rearm_rejected_refund_submission(uuid, uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.v2_rearm_rejected_refund_submission(uuid, uuid, integer) TO service_role;