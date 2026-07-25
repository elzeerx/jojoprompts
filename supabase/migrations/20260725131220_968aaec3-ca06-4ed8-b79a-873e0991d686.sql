
CREATE OR REPLACE FUNCTION public.v2_admin_payment_settings_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_orders_total          bigint := 0;
  v_orders_paid           bigint := 0;
  v_orders_failed         bigint := 0;
  v_orders_pending        bigint := 0;
  v_orders_refunded       bigint := 0;
  v_orders_part_refunded  bigint := 0;
  v_orders_cancelled      bigint := 0;
  v_attempts_total        bigint := 0;
  v_attempts_verif_paid   bigint := 0;
  v_attempts_verif_failed bigint := 0;
  v_attempts_mismatch     bigint := 0;
  v_events_total          bigint := 0;
  v_events_last_at        timestamptz;
  v_refunds_total         bigint := 0;
  v_refunds_processed     bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'forbidden';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'paid'::public.v2_order_status),
    count(*) FILTER (WHERE status = 'failed'::public.v2_order_status),
    count(*) FILTER (WHERE status = 'pending'::public.v2_order_status),
    count(*) FILTER (WHERE status = 'refunded'::public.v2_order_status),
    count(*) FILTER (WHERE status = 'partially_refunded'::public.v2_order_status),
    count(*) FILTER (WHERE status = 'cancelled'::public.v2_order_status)
  INTO v_orders_total, v_orders_paid, v_orders_failed, v_orders_pending,
       v_orders_refunded, v_orders_part_refunded, v_orders_cancelled
  FROM public.orders WHERE provider = 'upayments';

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'verified_paid'),
    count(*) FILTER (WHERE status IN ('failed','verified_failed')),
    count(*) FILTER (WHERE status IN ('mismatch','verified_mismatch'))
  INTO v_attempts_total, v_attempts_verif_paid, v_attempts_verif_failed, v_attempts_mismatch
  FROM public.payment_attempts WHERE provider = 'upayments';

  SELECT count(*), max(created_at)
  INTO v_events_total, v_events_last_at
  FROM public.payment_events WHERE provider = 'upayments';

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'processed'::public.v2_refund_status)
  INTO v_refunds_total, v_refunds_processed
  FROM public.refunds r
  WHERE EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = r.order_id AND o.provider = 'upayments'
  );

  RETURN jsonb_build_object(
    'provider', 'upayments',
    'period', 'all_time',
    'as_of', now(),
    'orders', jsonb_build_object(
      'total', v_orders_total,
      'paid', v_orders_paid,
      'failed', v_orders_failed,
      'pending', v_orders_pending,
      'refunded', v_orders_refunded,
      'partially_refunded', v_orders_part_refunded,
      'cancelled', v_orders_cancelled
    ),
    'payment_attempts', jsonb_build_object(
      'total', v_attempts_total,
      'verified_paid', v_attempts_verif_paid,
      'verified_failed', v_attempts_verif_failed,
      'mismatch', v_attempts_mismatch
    ),
    'payment_events', jsonb_build_object(
      'total', v_events_total,
      'last_event_at', v_events_last_at
    ),
    'refunds', jsonb_build_object(
      'total', v_refunds_total,
      'processed', v_refunds_processed
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.v2_admin_payment_settings_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_admin_payment_settings_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.v2_admin_payment_settings_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.v2_admin_payment_settings_summary() TO service_role;
