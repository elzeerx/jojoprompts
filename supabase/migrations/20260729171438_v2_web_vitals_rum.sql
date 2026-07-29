-- V2 privacy-safe Real User Monitoring (RUM) for Core Web Vitals.
--
-- The browser never writes to this table directly. A public Edge Function
-- validates a deliberately small payload, derives environment/device/rating,
-- and inserts with the service role. No account, cookie, email, IP address,
-- user agent, query string, or DOM attribution is retained.

CREATE TABLE public.web_vital_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL
    CHECK (metric_name IN ('LCP', 'INP', 'CLS')),
  value numeric NOT NULL
    CHECK (
      (metric_name = 'CLS' AND value >= 0 AND value <= 10)
      OR
      (metric_name IN ('LCP', 'INP') AND value >= 0 AND value <= 120000)
    ),
  rating text NOT NULL
    CHECK (rating IN ('good', 'needs-improvement', 'poor')),
  route_path text NOT NULL
    CHECK (
      char_length(route_path) BETWEEN 1 AND 160
      AND route_path ~ '^/[^?#]*$'
      AND route_path !~ '[[:cntrl:]]'
    ),
  device_class text NOT NULL
    CHECK (device_class IN ('mobile', 'desktop')),
  environment text NOT NULL
    CHECK (environment IN ('production', 'preview', 'development')),
  navigation_type text NOT NULL
    CHECK (
      navigation_type IN (
        'navigate',
        'reload',
        'back-forward',
        'back-forward-cache',
        'prerender',
        'restore',
        'soft-navigation'
      )
    ),
  metric_id text NOT NULL
    CHECK (
      char_length(metric_id) BETWEEN 1 AND 128
      AND metric_id ~ '^[A-Za-z0-9._:-]+$'
    ),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT web_vital_samples_metric_once
    UNIQUE (environment, metric_name, metric_id)
);

COMMENT ON TABLE public.web_vital_samples IS
  'Identity-free Core Web Vitals RUM. Retained for no longer than 90 days.';
COMMENT ON COLUMN public.web_vital_samples.route_path IS
  'Pathname only; query strings and fragments are rejected.';
COMMENT ON COLUMN public.web_vital_samples.metric_id IS
  'Navigation-scoped web-vitals identifier used only for deduplication.';

CREATE INDEX web_vital_samples_dashboard_idx
  ON public.web_vital_samples (
    environment,
    metric_name,
    device_class,
    recorded_at DESC
  );

CREATE INDEX web_vital_samples_retention_idx
  ON public.web_vital_samples (recorded_at);

ALTER TABLE public.web_vital_samples ENABLE ROW LEVEL SECURITY;

-- Fail closed through the Data API. Only the service role ingestion path and
-- the admin-only aggregation RPC below may access samples.
REVOKE ALL ON TABLE public.web_vital_samples FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.web_vital_samples TO service_role;

CREATE OR REPLACE FUNCTION public.get_admin_v2_web_vitals(
  p_period_days integer DEFAULT 7,
  p_environment text DEFAULT 'production'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_days integer := least(greatest(coalesce(p_period_days, 7), 1), 90);
  v_environment text := lower(coalesce(p_environment, 'production'));
  v_since timestamptz;
  v_min_samples constant integer := 75;
  v_metrics jsonb;
BEGIN
  IF NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  IF v_environment NOT IN ('production', 'preview', 'development') THEN
    RAISE EXCEPTION 'invalid_environment' USING ERRCODE = '22023';
  END IF;

  v_since := now() - make_interval(days => v_days);

  WITH grouped AS (
    SELECT
      metric_name,
      device_class,
      count(*)::integer AS sample_count,
      round(
        percentile_cont(0.75) WITHIN GROUP (ORDER BY value)::numeric,
        CASE WHEN metric_name = 'CLS' THEN 3 ELSE 0 END
      ) AS p75,
      round(
        100.0 * count(*) FILTER (WHERE rating = 'good') / count(*),
        1
      ) AS good_rate,
      max(recorded_at) AS latest_at
    FROM public.web_vital_samples
    WHERE environment = v_environment
      AND recorded_at >= v_since
    GROUP BY metric_name, device_class
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'metric_name', metric_name,
        'device_class', device_class,
        'sample_count', sample_count,
        'p75', p75,
        'good_rate', good_rate,
        'latest_at', latest_at,
        'sufficient_samples', sample_count >= v_min_samples
      )
      ORDER BY device_class, metric_name
    ),
    '[]'::jsonb
  )
  INTO v_metrics
  FROM grouped;

  RETURN jsonb_build_object(
    'period_days', v_days,
    'period_since', v_since,
    'environment', v_environment,
    'minimum_samples', v_min_samples,
    'metrics', v_metrics
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_v2_web_vitals(integer, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_v2_web_vitals(integer, text)
  TO authenticated, service_role;

-- Called by the ingestion function at most once per warm isolate. If traffic
-- pauses, no new data accumulates; the next accepted sample performs cleanup.
CREATE OR REPLACE FUNCTION public.purge_expired_web_vital_samples()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.web_vital_samples
   WHERE recorded_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_expired_web_vital_samples()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_web_vital_samples()
  TO service_role;
