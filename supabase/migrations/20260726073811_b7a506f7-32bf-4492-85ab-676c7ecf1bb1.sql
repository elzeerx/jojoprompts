CREATE OR REPLACE FUNCTION public.v2_admin_email_settings_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_window_start        timestamptz := now() - interval '24 hours';
  v_attempts_total      bigint := 0;
  v_sent                bigint := 0;
  v_failed              bigint := 0;
  v_blocked             bigint := 0;
  v_last_event_at       timestamptz;
  v_templates_active    bigint := 0;
  v_templates_inactive  bigint := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'forbidden';
  END IF;

  -- Precedence buckets over rows in the 24h window so that sent/failed/blocked
  -- are mutually exclusive. Any row that does not match a bucket is counted in
  -- attempts only (unknown/unclassified).
  --   blocked : status in ('blocked','bounced','complained','rejected')
  --   failed  : NOT blocked AND (success IS FALSE OR status in ('failed','error'))
  --   sent    : NOT blocked AND NOT failed AND (success IS TRUE OR status in ('sent','delivered'))
  SELECT
    count(*),
    count(*) FILTER (
      WHERE lower(coalesce(delivery_status, '')) NOT IN ('blocked','bounced','complained','rejected')
        AND lower(coalesce(delivery_status, '')) NOT IN ('failed','error')
        AND success IS NOT FALSE
        AND (
          success IS TRUE
          OR lower(coalesce(delivery_status, '')) IN ('sent','delivered')
        )
    ),
    count(*) FILTER (
      WHERE lower(coalesce(delivery_status, '')) NOT IN ('blocked','bounced','complained','rejected')
        AND (
          success IS FALSE
          OR lower(coalesce(delivery_status, '')) IN ('failed','error')
        )
    ),
    count(*) FILTER (
      WHERE lower(coalesce(delivery_status, '')) IN ('blocked','bounced','complained','rejected')
    ),
    max(coalesce(attempted_at, created_at))
  INTO v_attempts_total, v_sent, v_failed, v_blocked, v_last_event_at
  FROM public.email_logs
  WHERE coalesce(attempted_at, created_at) >= v_window_start;

  SELECT
    count(*) FILTER (WHERE is_active IS TRUE),
    count(*) FILTER (WHERE is_active IS FALSE)
  INTO v_templates_active, v_templates_inactive
  FROM public.email_templates;

  RETURN jsonb_build_object(
    'provider', 'resend',
    'window', '24h',
    'as_of', now(),
    'delivery', jsonb_build_object(
      'attempts', v_attempts_total,
      'sent', v_sent,
      'failed', v_failed,
      'blocked', v_blocked,
      'last_event_at', v_last_event_at
    ),
    'templates', jsonb_build_object(
      'active', v_templates_active,
      'inactive', v_templates_inactive
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.v2_admin_email_settings_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_admin_email_settings_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.v2_admin_email_settings_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.v2_admin_email_settings_summary() TO service_role;