CREATE OR REPLACE FUNCTION public.v2_admin_get_refundable_order(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
           'resource_title', COALESCE(rs.title_en, rs.title_ar),
           'resource_type', rs.type,
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
$function$;