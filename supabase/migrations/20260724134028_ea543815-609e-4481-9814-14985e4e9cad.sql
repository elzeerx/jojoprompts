-- =====================================================================
-- Phase 5.4 review follow-up: RPC-only corrections (no data mutations).
-- Replaces only the already-added Phase 5.4 RPCs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) v2_admin_finalize_definite_refund_rejection: enforce conservative
--    error-code grammar on both the expected and stored codes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_admin_finalize_definite_refund_rejection(
  p_refund_id uuid,
  p_expected_http_status integer,
  p_expected_error_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_row public.refunds%ROWTYPE;
  v_stored_code text;
  v_expected_code text;
  v_event_id text;
  v_payload jsonb;
  -- Conservative token grammar for provider error codes.
  v_code_re constant text := '^[A-Za-z0-9_.:-]{1,80}$';
BEGIN
  v_actor := public._v2_require_admin();

  IF p_refund_id IS NULL OR p_expected_http_status IS NULL
     OR p_expected_error_code IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE='22023';
  END IF;

  v_expected_code := btrim(p_expected_error_code);
  IF v_expected_code = '' OR v_expected_code !~ v_code_re THEN
    RAISE EXCEPTION 'invalid_expected_error_code' USING ERRCODE='22023';
  END IF;

  IF p_expected_http_status < 400 OR p_expected_http_status > 499 THEN
    RAISE EXCEPTION 'expected_http_status_out_of_range' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_row FROM public.refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002';
  END IF;

  v_stored_code := btrim(COALESCE(v_row.sanitized_provider_payload->>'error_code',''));

  -- Idempotent replay: already-failed row with same stored diagnostics → noop.
  IF v_row.status = 'failed'::public.v2_refund_status
     AND v_row.provider_submission_state = 'failed'
     AND v_row.last_provider_http_status IS NOT DISTINCT FROM p_expected_http_status
     AND v_stored_code = v_expected_code
     AND v_stored_code ~ v_code_re THEN
    RETURN jsonb_build_object('ok', true, 'noop', true,
      'refund_id', v_row.id, 'status', 'failed');
  END IF;

  IF v_row.status IS DISTINCT FROM 'pending'::public.v2_refund_status THEN
    RAISE EXCEPTION 'refund_status_not_pending' USING ERRCODE='22023';
  END IF;
  IF v_row.provider_submission_state IS DISTINCT FROM 'submission_unknown' THEN
    RAISE EXCEPTION 'submission_state_not_unknown' USING ERRCODE='22023';
  END IF;
  IF v_row.last_provider_http_status IS NULL
     OR v_row.last_provider_http_status <> p_expected_http_status THEN
    RAISE EXCEPTION 'http_status_mismatch' USING ERRCODE='22023';
  END IF;
  IF v_row.last_provider_http_status < 400
     OR v_row.last_provider_http_status > 499 THEN
    RAISE EXCEPTION 'last_http_status_not_client_error' USING ERRCODE='22023';
  END IF;
  IF v_row.provider_reference IS NOT NULL
     OR v_row.provider_refund_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'provider_refund_present' USING ERRCODE='22023';
  END IF;
  IF v_stored_code = '' OR v_stored_code <> v_expected_code
     OR v_stored_code !~ v_code_re THEN
    RAISE EXCEPTION 'error_code_mismatch' USING ERRCODE='22023';
  END IF;

  v_event_id := ('upay:refund:' || v_row.id::text
                 || ':admin_definite_rejection:'
                 || p_expected_http_status::text || ':' || v_expected_code);
  v_event_id := left(v_event_id, 256);

  v_payload := jsonb_build_object(
    'kind', 'admin_finalized_definite_rejection',
    'http_status', p_expected_http_status,
    'error_code', v_expected_code,
    'message', v_row.sanitized_provider_payload->>'message'
  );

  PERFORM public.v2_insert_or_verify_payment_event(
    v_row.order_id, 'upayments', v_event_id,
    'failed'::public.v2_payment_event_type,
    v_row.amount_fils, 'KWD', v_payload);

  UPDATE public.refunds
     SET status = 'failed'::public.v2_refund_status,
         provider_submission_state = 'failed',
         last_checked_at = now(),
         updated_at = now()
   WHERE id = p_refund_id;

  INSERT INTO public.activity_events(
    actor_user_id, actor_type, entity_type, entity_id, action, metadata)
  VALUES (v_actor, 'admin', 'refund', p_refund_id,
    'v2_refund_definite_rejection_finalized',
    jsonb_build_object(
      'http_status', p_expected_http_status,
      'error_code', v_expected_code,
      'order_id', v_row.order_id));

  RETURN jsonb_build_object('ok', true, 'noop', false,
    'refund_id', p_refund_id, 'status', 'failed');
END
$$;

REVOKE ALL ON FUNCTION public.v2_admin_finalize_definite_refund_rejection(uuid, integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_admin_finalize_definite_refund_rejection(uuid, integer, text)
  TO authenticated;


-- ---------------------------------------------------------------------
-- 2) v2_admin_list_recovery: apply same regex to stored error_code
--    when advertising can_finalize_definite_rejection.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_admin_list_recovery(
  p_kind text DEFAULT NULL,
  p_min_age_minutes int DEFAULT 0,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_limit int; v_offset int := GREATEST(COALESCE(p_offset,0),0);
  v_min interval := make_interval(mins => GREATEST(COALESCE(p_min_age_minutes,0),0));
  v_total bigint; v_rows jsonb;
  v_code_re constant text := '^[A-Za-z0-9_.:-]{1,80}$';
BEGIN
  v_actor := public._v2_require_admin();
  v_limit := public._v2_bounded_limit(p_limit, 200);

  WITH unioned AS (
    SELECT 'charge_submission_unknown' AS kind, 'high' AS severity,
           pa.order_id AS order_id, NULL::uuid AS refund_id,
           pa.updated_at AS last_activity_at,
           jsonb_build_object(
             'attempt_id', pa.id,
             'provider', pa.provider,
             'http_status', pa.last_provider_http_status,
             'submission_state', pa.provider_submission_state) AS meta,
           'Payment submission state is unknown — verify with provider status.' AS reason,
           pa.last_checked_at AS last_checked_at
    FROM public.payment_attempts pa
    WHERE pa.provider_submission_state = 'submission_unknown'

    UNION ALL
    SELECT 'stale_payment_attempt', 'medium',
           pa.order_id, NULL,
           pa.updated_at,
           jsonb_build_object('attempt_id', pa.id, 'status', pa.status,
             'submission_state', pa.provider_submission_state),
           'Payment attempt has been pending too long.',
           pa.last_checked_at
    FROM public.payment_attempts pa
    WHERE pa.provider_submission_state IN ('pending','submitting','submitted')
      AND pa.updated_at < now() - interval '2 hours'

    UNION ALL
    -- refund_submission_unknown: expose safe diagnostics + finalization flag.
    -- Requires stored error_code to satisfy the same conservative token regex
    -- enforced by v2_admin_finalize_definite_refund_rejection.
    SELECT 'refund_submission_unknown', 'high',
           r.order_id, r.id,
           r.updated_at,
           jsonb_build_object(
             'submission_state', r.provider_submission_state,
             'http_status', r.last_provider_http_status,
             'error_code', r.sanitized_provider_payload->>'error_code',
             'message', r.sanitized_provider_payload->>'message',
             'provider_reference', r.provider_reference,
             'provider_refund_order_id', r.provider_refund_order_id,
             'can_finalize_definite_rejection',
               (r.status = 'pending'::public.v2_refund_status
                AND r.provider_submission_state = 'submission_unknown'
                AND r.last_provider_http_status BETWEEN 400 AND 499
                AND r.provider_reference IS NULL
                AND r.provider_refund_order_id IS NULL
                AND btrim(COALESCE(r.sanitized_provider_payload->>'error_code','')) ~ v_code_re)
           ),
           'Refund submission state is unknown — re-check provider status or finalize a definite 4xx rejection.',
           r.last_checked_at
    FROM public.refunds r
    WHERE r.provider_submission_state = 'submission_unknown'

    UNION ALL
    -- refund_awaiting_status: keep visible even if provider IDs are missing;
    -- UI gates the Re-check button on IDs + submission state.
    SELECT 'refund_awaiting_status', 'medium',
           r.order_id, r.id,
           r.updated_at,
           jsonb_build_object(
             'status', r.status,
             'submission_state', r.provider_submission_state,
             'provider_reference', r.provider_reference,
             'provider_refund_order_id', r.provider_refund_order_id),
           'Refund awaiting provider terminal status.',
           r.last_checked_at
    FROM public.refunds r
    WHERE r.status IN ('approved'::public.v2_refund_status)
      AND r.provider_submission_state = 'submitted'
      AND r.updated_at < now() - interval '30 minutes'

    UNION ALL
    SELECT 'refund_failed', 'high',
           r.order_id, r.id,
           r.updated_at,
           jsonb_build_object(
             'status', r.status,
             'submission_state', r.provider_submission_state,
             'http_status', r.last_provider_http_status,
             'error_code', r.sanitized_provider_payload->>'error_code',
             'message', r.sanitized_provider_payload->>'message',
             'provider_reference', r.provider_reference,
             'provider_refund_order_id', r.provider_refund_order_id,
             'can_finalize_definite_rejection', false),
           'Refund reported failed by provider.',
           r.last_checked_at
    FROM public.refunds r
    WHERE r.status = 'failed'::public.v2_refund_status

    UNION ALL
    SELECT 'verification_rejection', 'high',
           a.entity_id, NULL,
           a.created_at,
           a.metadata,
           'Provider verification rejection recorded — inspect payload.',
           NULL
    FROM public.activity_events a
    WHERE a.action LIKE 'v2_upayments_verification_rejection%'
      AND a.entity_type = 'order'
  ), filt AS (
    SELECT * FROM unioned
    WHERE (p_kind IS NULL OR kind = p_kind)
      AND (last_activity_at IS NULL OR last_activity_at <= now() - v_min)
  ), page AS (
    SELECT u.*, o.order_number, o.status AS order_status,
           pf.email AS user_email, o.user_id
    FROM filt u
    LEFT JOIN public.orders o ON o.id = u.order_id
    LEFT JOIN public.profiles pf ON pf.id = o.user_id
    ORDER BY u.last_activity_at DESC NULLS LAST
    LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT COUNT(*) FROM filt),
         COALESCE(jsonb_agg(jsonb_build_object(
           'kind', p.kind, 'severity', p.severity,
           'order_id', p.order_id, 'order_number', p.order_number,
           'order_status', p.order_status,
           'refund_id', p.refund_id,
           'user_id', p.user_id,
           'user_email_masked', public._v2_mask_email(p.user_email),
           'age_seconds', EXTRACT(EPOCH FROM (now() - p.last_activity_at))::bigint,
           'last_activity_at', p.last_activity_at,
           'last_checked_at', p.last_checked_at,
           'reason', p.reason,
           'meta', p.meta
         ) ORDER BY p.last_activity_at DESC NULLS LAST), '[]'::jsonb)
  INTO v_total, v_rows
  FROM page p;

  RETURN jsonb_build_object('total_count', v_total, 'rows', v_rows,
    'limit', v_limit, 'offset', v_offset);
END
$$;
REVOKE ALL ON FUNCTION public.v2_admin_list_recovery(text,int,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_recovery(text,int,int,int) TO authenticated;


-- ---------------------------------------------------------------------
-- 3) v2_admin_reconcile_order: replace credit rule with correct
--    paid_order_credit_mismatch, and add
--    nonprocessed_refund_with_revoked_entitlement.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.v2_admin_reconcile_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_order public.orders%ROWTYPE;
  v_items_count int; v_alloc_sum bigint;
  v_attempts_count int; v_verified_paid_count int;
  v_captured_events int; v_failed_events int;
  v_active_ents int; v_revoked_ents int;
  v_pos_credit bigint; v_net_credit bigint;
  v_refunds_pending int; v_refunds_approved int;
  v_refunds_processed int; v_refunds_failed int;
  v_processed_refund_fils bigint; v_neg_credit_linked bigint;
  v_issues jsonb := '[]'::jsonb;
BEGIN
  v_actor := public._v2_require_admin();

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE='P0002';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(paid_allocation_fils),0)
    INTO v_items_count, v_alloc_sum
  FROM public.order_items WHERE order_id = p_order_id;

  SELECT COUNT(*) INTO v_attempts_count
    FROM public.payment_attempts WHERE order_id = p_order_id;
  SELECT COUNT(*) INTO v_verified_paid_count
    FROM public.payment_attempts
   WHERE order_id = p_order_id AND status = 'verified_paid';

  SELECT COUNT(*) FILTER (WHERE event_type='captured'),
         COUNT(*) FILTER (WHERE event_type='failed')
    INTO v_captured_events, v_failed_events
  FROM public.payment_events WHERE order_id = p_order_id;

  SELECT COUNT(*) FILTER (WHERE revoked_at IS NULL),
         COUNT(*) FILTER (WHERE revoked_at IS NOT NULL)
    INTO v_active_ents, v_revoked_ents
  FROM public.entitlements WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(amount_fils) FILTER (WHERE amount_fils > 0),0),
         COALESCE(SUM(amount_fils),0)
    INTO v_pos_credit, v_net_credit
  FROM public.lifetime_credit_entries WHERE order_id = p_order_id;

  SELECT COUNT(*) FILTER (WHERE status='pending'),
         COUNT(*) FILTER (WHERE status='approved'),
         COUNT(*) FILTER (WHERE status='processed'),
         COUNT(*) FILTER (WHERE status='failed'),
         COALESCE(SUM(amount_fils) FILTER (WHERE status='processed'),0)
    INTO v_refunds_pending, v_refunds_approved, v_refunds_processed,
         v_refunds_failed, v_processed_refund_fils
  FROM public.refunds WHERE order_id = p_order_id;

  SELECT COALESCE(SUM(-l.amount_fils),0) INTO v_neg_credit_linked
    FROM public.lifetime_credit_entries l
    JOIN public.refunds r ON r.id = l.refund_id
   WHERE r.order_id = p_order_id AND l.amount_fils < 0;

  -- ---------- Issues ----------

  IF v_order.status IN ('paid'::public.v2_order_status,
                        'refunded'::public.v2_order_status,
                        'partially_refunded'::public.v2_order_status)
     AND v_order.paid_fils IS DISTINCT FROM v_order.total_fils
     AND v_order.paid_fils + COALESCE(v_order.lifetime_credit_applied_fils,0)
         IS DISTINCT FROM v_order.total_fils THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code','paid_fils_vs_total_mismatch',
      'severity','high',
      'detail', jsonb_build_object('paid_fils', v_order.paid_fils,
        'total_fils', v_order.total_fils,
        'lifetime_credit_applied_fils', v_order.lifetime_credit_applied_fils)));
  END IF;

  IF v_order.status = 'paid'::public.v2_order_status
     AND v_alloc_sum <> v_order.paid_fils THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code','paid_allocation_sum_vs_paid_fils',
      'severity','high',
      'detail', jsonb_build_object('alloc_sum', v_alloc_sum, 'paid_fils', v_order.paid_fils)));
  END IF;

  IF v_order.status = 'paid'::public.v2_order_status
     AND v_order.provider = 'upayments'
     AND v_verified_paid_count = 0 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code','paid_upayments_missing_verified_attempt',
      'severity','high', 'detail', jsonb_build_object()));
  END IF;

  IF v_order.status = 'paid'::public.v2_order_status AND v_captured_events = 0 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code','paid_order_missing_captured_event','severity','high',
      'detail', jsonb_build_object()));
  END IF;
  IF v_captured_events > 1 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code','duplicate_captured_events','severity','high',
      'detail', jsonb_build_object('count', v_captured_events)));
  END IF;

  IF v_order.status = 'paid'::public.v2_order_status
     AND v_items_count > 0 AND v_active_ents = 0 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code','paid_order_missing_active_entitlement','severity','high',
      'detail', jsonb_build_object()));
  END IF;

  -- REPLACED RULE: paid_order_credit_mismatch.
  -- `lifetime_credit_applied_fils` on the order is PREVIOUS account credit
  -- APPLIED to a lifetime checkout, whereas positive lifetime_credit_entries
  -- for the order equal the AMOUNT ACTUALLY SETTLED. For paid orders they
  -- should equal paid_fils. QA order 900 vs 900 stays healthy.
  IF v_order.status = 'paid'::public.v2_order_status
     AND v_pos_credit IS DISTINCT FROM v_order.paid_fils THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code','paid_order_credit_mismatch',
      'severity','medium',
      'detail', jsonb_build_object(
        'positive_credit_fils', v_pos_credit,
        'paid_fils', v_order.paid_fils)));
  END IF;

  IF (v_refunds_pending + v_refunds_approved + v_refunds_processed) > 0 THEN
    IF (SELECT COALESCE(SUM(amount_fils),0) FROM public.refunds
         WHERE order_id = p_order_id
           AND status IN ('pending'::public.v2_refund_status,
                          'approved'::public.v2_refund_status,
                          'processed'::public.v2_refund_status)) > v_order.paid_fils THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code','refund_total_over_paid','severity','high',
        'detail', jsonb_build_object()));
    END IF;
  END IF;

  IF v_refunds_processed > 0 AND v_processed_refund_fils > 0
     AND v_neg_credit_linked < v_processed_refund_fils THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code','processed_refund_missing_negative_credit','severity','high',
      'detail', jsonb_build_object('processed_fils', v_processed_refund_fils,
        'negative_credit_linked', v_neg_credit_linked)));
  END IF;

  IF (v_refunds_pending + v_refunds_approved + v_refunds_failed) > 0
     AND v_processed_refund_fils = 0 AND v_neg_credit_linked > 0 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code','nonprocessed_refund_with_negative_credit','severity','high',
      'detail', jsonb_build_object()));
  END IF;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT ri.order_item_id, SUM(ri.amount_fils) AS s, MAX(oi.paid_allocation_fils) AS cap
        FROM public.refund_items ri
        JOIN public.refunds r ON r.id = ri.refund_id
        JOIN public.order_items oi ON oi.id = ri.order_item_id
       WHERE r.order_id = p_order_id
         AND r.status = 'processed'::public.v2_refund_status
       GROUP BY ri.order_item_id
      HAVING SUM(ri.amount_fils) >= MAX(oi.paid_allocation_fils)
         AND EXISTS (SELECT 1 FROM public.entitlements e
                      WHERE e.source_order_item_id = ri.order_item_id
                        AND e.revoked_at IS NULL)
    ) t
  ) THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code','fully_refunded_item_with_active_entitlement','severity','high',
      'detail', jsonb_build_object()));
  END IF;

  -- NEW RULE: nonprocessed_refund_with_revoked_entitlement.
  -- Flag when a pending/approved/failed refund's refund_item points to an
  -- already-revoked entitlement, UNLESS a separate PROCESSED refund fully
  -- covers the same order_item (which legitimately explains the revocation).
  IF EXISTS (
    SELECT 1
    FROM public.refund_items ri
    JOIN public.refunds r ON r.id = ri.refund_id
    JOIN public.entitlements e ON e.source_order_item_id = ri.order_item_id
    JOIN public.order_items oi ON oi.id = ri.order_item_id
    WHERE r.order_id = p_order_id
      AND r.status IN ('pending'::public.v2_refund_status,
                       'approved'::public.v2_refund_status,
                       'failed'::public.v2_refund_status)
      AND e.revoked_at IS NOT NULL
      AND e.order_id = p_order_id
      AND NOT EXISTS (
        SELECT 1 FROM (
          SELECT ri2.order_item_id, SUM(ri2.amount_fils) AS s
            FROM public.refund_items ri2
            JOIN public.refunds r2 ON r2.id = ri2.refund_id
           WHERE r2.order_id = p_order_id
             AND r2.status = 'processed'::public.v2_refund_status
             AND ri2.order_item_id = ri.order_item_id
           GROUP BY ri2.order_item_id
        ) covered
        WHERE covered.s >= oi.paid_allocation_fils
      )
  ) THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code','nonprocessed_refund_with_revoked_entitlement',
      'severity','high',
      'detail', jsonb_build_object()));
  END IF;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'currency', v_order.currency,
      'provider', v_order.provider,
      'total_fils', v_order.total_fils,
      'paid_fils', v_order.paid_fils,
      'lifetime_credit_applied_fils', v_order.lifetime_credit_applied_fils,
      'placed_at', v_order.placed_at,
      'settled_at', v_order.settled_at),
    'counts', jsonb_build_object(
      'order_items', v_items_count,
      'paid_allocation_sum_fils', v_alloc_sum,
      'payment_attempts', v_attempts_count,
      'verified_paid_attempts', v_verified_paid_count,
      'captured_events', v_captured_events,
      'failed_events', v_failed_events,
      'active_entitlements', v_active_ents,
      'revoked_entitlements', v_revoked_ents,
      'positive_credit_fils', v_pos_credit,
      'net_credit_fils', v_net_credit,
      'refunds_pending', v_refunds_pending,
      'refunds_approved', v_refunds_approved,
      'refunds_processed', v_refunds_processed,
      'refunds_failed', v_refunds_failed,
      'processed_refund_fils', v_processed_refund_fils,
      'negative_credit_linked_fils', v_neg_credit_linked),
    'issues', v_issues,
    'healthy', (jsonb_array_length(v_issues) = 0),
    'as_of', now()
  );
END
$$;

REVOKE ALL ON FUNCTION public.v2_admin_reconcile_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.v2_admin_reconcile_order(uuid) TO authenticated;