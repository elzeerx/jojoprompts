
-- =========================================================================
-- 1) Customer-safe order history & receipt RPCs.
--    Derive actor from auth.uid() only; never trust client user id.
--    Expose only safe fields; no payment_attempts / payment_events /
--    raw provider payloads / provider IDs.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.v2_get_my_orders(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_limit int;
  v_offset int;
  v_rows jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  SELECT COALESCE(jsonb_agg(row_to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      o.id,
      o.order_number,
      o.status::text                          AS status,
      o.currency,
      o.total_fils,
      o.paid_fils,
      COALESCE((
        SELECT SUM(r.amount_fils)
        FROM public.refunds r
        WHERE r.order_id = o.id
          AND r.status = 'processed'::public.v2_refund_status
      ), 0)::int                              AS refunded_fils,
      o.placed_at,
      o.settled_at,
      o.created_at,
      (SELECT COUNT(*)::int FROM public.order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM public.orders o
    WHERE o.user_id = v_user
    ORDER BY o.created_at DESC
    OFFSET v_offset LIMIT v_limit
  ) t;

  RETURN jsonb_build_object('ok', true, 'orders', v_rows);
END $$;

REVOKE ALL ON FUNCTION public.v2_get_my_orders(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_get_my_orders(int, int) FROM anon;
REVOKE ALL ON FUNCTION public.v2_get_my_orders(int, int) FROM service_role;
GRANT EXECUTE ON FUNCTION public.v2_get_my_orders(int, int) TO authenticated;


CREATE OR REPLACE FUNCTION public.v2_get_my_order_receipt(
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order record;
  v_items jsonb;
  v_refunds jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid_order_id' USING ERRCODE = '22023';
  END IF;

  SELECT o.id, o.order_number, o.status::text AS status, o.currency,
         o.subtotal_fils, o.discount_fils, o.discount_code,
         o.total_fils, o.paid_fils, o.lifetime_credit_applied_fils,
         o.placed_at, o.settled_at, o.created_at, o.user_id
    INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
     AND o.user_id = v_user;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      oi.id,
      oi.product_id,
      oi.resource_id,
      oi.quantity,
      oi.unit_price_fils,
      oi.line_total_fils,
      oi.paid_allocation_fils,
      oi.acquired_major_version,
      oi.created_at,
      r.slug        AS resource_slug,
      r.type::text  AS resource_type,
      r.title_en    AS title_en,
      r.title_ar    AS title_ar,
      p.product_type::text AS product_type
    FROM public.order_items oi
    LEFT JOIN public.resources r ON r.id = oi.resource_id
    LEFT JOIN public.products  p ON p.id = oi.product_id
    WHERE oi.order_id = v_order.id
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_refunds
  FROM (
    SELECT
      r.id,
      r.status::text AS status,
      r.amount_fils,
      r.reason,
      r.requested_at,
      r.processed_at,
      r.created_at
    FROM public.refunds r
    WHERE r.order_id = v_order.id
      AND r.status IN (
        'processed'::public.v2_refund_status,
        'approved'::public.v2_refund_status,
        'failed'::public.v2_refund_status
      )
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'status', v_order.status,
      'currency', v_order.currency,
      'subtotal_fils', v_order.subtotal_fils,
      'discount_fils', v_order.discount_fils,
      'discount_code', v_order.discount_code,
      'total_fils', v_order.total_fils,
      'paid_fils', v_order.paid_fils,
      'lifetime_credit_applied_fils', v_order.lifetime_credit_applied_fils,
      'placed_at', v_order.placed_at,
      'settled_at', v_order.settled_at,
      'created_at', v_order.created_at
    ),
    'items', v_items,
    'refunds', v_refunds
  );
END $$;

REVOKE ALL ON FUNCTION public.v2_get_my_order_receipt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_get_my_order_receipt(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.v2_get_my_order_receipt(uuid) FROM service_role;
GRANT EXECUTE ON FUNCTION public.v2_get_my_order_receipt(uuid) TO authenticated;


-- =========================================================================
-- 2) Refund wrapper precondition: require provider_submission_state='submitted'
--    for approved -> processed. Idempotent 'processed' replay stays allowed.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.v2_apply_verified_refund_correlated(
  p_admin_actor_id       uuid,
  p_refund_id            uuid,
  p_provider_reference   text,
  p_provider_refund_order_id text,
  p_result               text,
  p_external_event_id    text,
  p_sanitized_payload    jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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

  SELECT r.order_id, o.user_id
    INTO v_order_id, v_user_id
    FROM public.refunds r
    JOIN public.orders o ON o.id = r.order_id
   WHERE r.id = p_refund_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'refund_not_found' USING ERRCODE='P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('v2user:' || v_user_id::text, 0));

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

  IF v_refund.provider_reference IS DISTINCT FROM p_provider_reference
     OR v_refund.provider_refund_order_id IS DISTINCT FROM p_provider_refund_order_id THEN
    RAISE EXCEPTION 'refund_identifier_mismatch' USING ERRCODE='22023';
  END IF;

  IF v_refund.status NOT IN ('approved'::public.v2_refund_status,
                             'processed'::public.v2_refund_status) THEN
    RAISE EXCEPTION 'refund_not_approved' USING ERRCODE='22023';
  END IF;

  -- NEW: require submitted provider work before approved -> processed.
  -- Idempotent processed replay (already terminal) does not require this check.
  IF v_refund.status = 'approved'::public.v2_refund_status
     AND COALESCE(v_refund.provider_submission_state, '') <> 'submitted' THEN
    RAISE EXCEPTION 'refund_not_submitted' USING ERRCODE='22023';
  END IF;

  RETURN public.v2_apply_verified_refund(
    p_admin_actor_id, p_refund_id, p_provider_refund_order_id,
    p_result, p_external_event_id, p_sanitized_payload);
END $$;

REVOKE ALL ON FUNCTION public.v2_apply_verified_refund_correlated(
  uuid, uuid, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_apply_verified_refund_correlated(
  uuid, uuid, text, text, text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.v2_apply_verified_refund_correlated(
  uuid, uuid, text, text, text, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.v2_apply_verified_refund_correlated(
  uuid, uuid, text, text, text, text, jsonb) TO service_role;
