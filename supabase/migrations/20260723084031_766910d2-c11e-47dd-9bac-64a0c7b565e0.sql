
-- =========================================================================
-- Phase 5.3 admin read RPCs (Refunds + Recovery)
-- =========================================================================

-- 1) Refundable order snapshot with per-item remaining allocation.
CREATE OR REPLACE FUNCTION public.v2_admin_get_refundable_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_order jsonb;
  v_items jsonb;
  v_remaining_total bigint := 0;
BEGIN
  v_actor := public._v2_require_admin();

  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'currency', o.currency,
    'total_fils', o.total_fils,
    'paid_fils', o.paid_fils,
    'provider', o.provider,
    'provider_reference', o.provider_reference,
    'user_id', o.user_id,
    'user_email', p.email,
    'placed_at', o.placed_at,
    'settled_at', o.settled_at
  )
  INTO v_order
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.id = p_order_id;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Sum already-refunded allocations per item, only from refunds not in a
  -- terminal-failed / rejected state. We treat pending + approved + processed
  -- as blocking further refund amount, since those funds are in-flight or
  -- already reversed.
  WITH item_refunded AS (
    SELECT ri.order_item_id, COALESCE(SUM(ri.amount_fils),0)::bigint AS refunded_fils
    FROM public.refund_items ri
    JOIN public.refunds r ON r.id = ri.refund_id
    WHERE r.order_id = p_order_id
      AND r.status IN ('pending','approved','processed')
    GROUP BY ri.order_item_id
  ),
  item_ents AS (
    SELECT e.source_order_item_id AS order_item_id,
           jsonb_agg(jsonb_build_object(
             'id', e.id,
             'scope', e.scope,
             'resource_id', e.resource_id,
             'grant_reason', e.grant_reason,
             'granted_at', e.granted_at,
             'revoked_at', e.revoked_at
           ) ORDER BY e.granted_at DESC) AS entitlements
    FROM public.entitlements e
    WHERE e.order_id = p_order_id
      AND e.source_order_item_id IS NOT NULL
    GROUP BY e.source_order_item_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', oi.id,
           'product_id', oi.product_id,
           'resource_id', oi.resource_id,
           'quantity', oi.quantity,
           'unit_price_fils', oi.unit_price_fils,
           'line_total_fils', oi.line_total_fils,
           'paid_allocation_fils', COALESCE(oi.paid_allocation_fils,0),
           'already_refunded_fils', COALESCE(ir.refunded_fils,0),
           'remaining_refundable_fils',
             GREATEST(COALESCE(oi.paid_allocation_fils,0) - COALESCE(ir.refunded_fils,0), 0),
           'product_sku', pr.sku,
           'product_type', pr.product_type,
           'resource_title', rs.title,
           'resource_type', rs.resource_type,
           'active_entitlements', COALESCE(ie.entitlements, '[]'::jsonb)
         ) ORDER BY oi.created_at), '[]'::jsonb),
         COALESCE(SUM(
           GREATEST(COALESCE(oi.paid_allocation_fils,0) - COALESCE(ir.refunded_fils,0), 0)
         ), 0)::bigint
  INTO v_items, v_remaining_total
  FROM public.order_items oi
  LEFT JOIN public.products pr ON pr.id = oi.product_id
  LEFT JOIN public.resources rs ON rs.id = oi.resource_id
  LEFT JOIN item_refunded ir ON ir.order_item_id = oi.id
  LEFT JOIN item_ents ie ON ie.order_item_id = oi.id
  WHERE oi.order_id = p_order_id;

  RETURN jsonb_build_object(
    'order', v_order,
    'items', v_items,
    'remaining_refundable_total_fils', v_remaining_total,
    'eligible',
      (v_order->>'status') IN ('paid','partially_refunded')
      AND v_remaining_total > 0
  );
END
$$;

REVOKE ALL ON FUNCTION public.v2_admin_get_refundable_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_admin_get_refundable_order(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.v2_admin_get_refundable_order(uuid) FROM service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_get_refundable_order(uuid) TO authenticated;

-- =========================================================================
-- 2) v2_admin_get_refund_detail
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_admin_get_refund_detail(p_refund_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_refund jsonb;
  v_items jsonb;
  v_ents jsonb;
  v_credit jsonb;
  v_activity jsonb;
BEGIN
  v_actor := public._v2_require_admin();

  SELECT jsonb_build_object(
    'id', r.id,
    'order_id', r.order_id,
    'order_number', o.order_number,
    'user_id', r.user_id,
    'user_email', p.email,
    'status', r.status,
    'amount_fils', r.amount_fils,
    'currency', r.currency,
    'reason', r.reason,
    'provider', r.provider,
    'provider_reference', r.provider_reference,
    'provider_refund_order_id', r.provider_refund_order_id,
    'provider_submission_state', r.provider_submission_state,
    'last_provider_http_status', r.last_provider_http_status,
    'requested_at', r.requested_at,
    'processed_at', r.processed_at,
    'last_checked_at', r.last_checked_at,
    'next_check_after', r.next_check_after,
    'check_count', r.check_count,
    'created_at', r.created_at,
    'updated_at', r.updated_at
  )
  INTO v_refund
  FROM public.refunds r
  LEFT JOIN public.orders o ON o.id = r.order_id
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.id = p_refund_id;

  IF v_refund IS NULL THEN
    RAISE EXCEPTION 'refund_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'order_item_id', ri.order_item_id,
           'amount_fils', ri.amount_fils,
           'product_sku', pr.sku,
           'resource_title', rs.title,
           'paid_allocation_fils', COALESCE(oi.paid_allocation_fils,0)
         )), '[]'::jsonb)
  INTO v_items
  FROM public.refund_items ri
  LEFT JOIN public.order_items oi ON oi.id = ri.order_item_id
  LEFT JOIN public.products pr ON pr.id = oi.product_id
  LEFT JOIN public.resources rs ON rs.id = oi.resource_id
  WHERE ri.refund_id = p_refund_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', e.id,
           'scope', e.scope,
           'resource_id', e.resource_id,
           'grant_reason', e.grant_reason,
           'source_order_item_id', e.source_order_item_id,
           'granted_at', e.granted_at,
           'revoked_at', e.revoked_at,
           'revoke_reason', e.revoke_reason
         ) ORDER BY e.granted_at DESC), '[]'::jsonb)
  INTO v_ents
  FROM public.entitlements e
  WHERE e.order_id = (v_refund->>'order_id')::uuid
    AND e.source_order_item_id IN (
      SELECT ri.order_item_id FROM public.refund_items ri WHERE ri.refund_id = p_refund_id
    );

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', lc.id,
           'amount_fils', lc.amount_fils,
           'reason', lc.reason,
           'occurred_at', lc.occurred_at
         ) ORDER BY lc.occurred_at DESC), '[]'::jsonb)
  INTO v_credit
  FROM public.lifetime_credit_entries lc
  WHERE lc.refund_id = p_refund_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', a.id, 'action', a.action, 'actor_type', a.actor_type,
           'entity_type', a.entity_type, 'entity_id', a.entity_id,
           'metadata', a.metadata, 'created_at', a.created_at
         ) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_activity
  FROM public.activity_events a
  WHERE a.entity_id = p_refund_id
     OR (a.entity_type = 'refund' AND a.entity_id = p_refund_id);

  RETURN jsonb_build_object(
    'refund', v_refund,
    'items', v_items,
    'entitlements', v_ents,
    'lifetime_credit', v_credit,
    'activity', v_activity
  );
END
$$;

REVOKE ALL ON FUNCTION public.v2_admin_get_refund_detail(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_admin_get_refund_detail(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.v2_admin_get_refund_detail(uuid) FROM service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_get_refund_detail(uuid) TO authenticated;

-- =========================================================================
-- 3) v2_admin_recovery_counts
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_admin_recovery_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_total bigint;
  v_by_kind jsonb;
BEGIN
  v_actor := public._v2_require_admin();

  WITH unioned AS (
    SELECT 'charge_submission_unknown' AS kind
      FROM public.payment_attempts pa
     WHERE pa.provider_submission_state = 'submission_unknown'
    UNION ALL
    SELECT 'stale_payment_attempt'
      FROM public.payment_attempts pa
     WHERE pa.provider_submission_state IN ('pending','submitting','submitted')
       AND pa.updated_at < now() - interval '2 hours'
    UNION ALL
    SELECT 'refund_submission_unknown'
      FROM public.refunds r
     WHERE r.provider_submission_state = 'submission_unknown'
    UNION ALL
    SELECT 'refund_awaiting_status'
      FROM public.refunds r
     WHERE r.status = 'approved'
       AND r.provider_submission_state = 'submitted'
       AND r.updated_at < now() - interval '30 minutes'
    UNION ALL
    SELECT 'refund_failed'
      FROM public.refunds r
     WHERE r.status = 'failed'
    UNION ALL
    SELECT 'verification_rejection'
      FROM public.activity_events a
     WHERE a.action LIKE 'v2_upayments_verification_rejection%'
       AND a.entity_type = 'order'
  )
  SELECT COUNT(*)::bigint,
         COALESCE(jsonb_object_agg(kind, cnt), '{}'::jsonb)
  INTO v_total, v_by_kind
  FROM (SELECT kind, COUNT(*)::bigint AS cnt FROM unioned GROUP BY kind) t;

  RETURN jsonb_build_object('total', COALESCE(v_total,0), 'by_kind', v_by_kind);
END
$$;

REVOKE ALL ON FUNCTION public.v2_admin_recovery_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_admin_recovery_counts() FROM anon;
REVOKE ALL ON FUNCTION public.v2_admin_recovery_counts() FROM service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_recovery_counts() TO authenticated;
