
CREATE OR REPLACE FUNCTION public.v2_internal_admin_storage_settings_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_registered_files       bigint := 0;
  v_registered_bytes       bigint := 0;
  v_checksum_ready_files   bigint := 0;
  v_last_registered_at     timestamptz;
  v_clean                  bigint := 0;
  v_pending                bigint := 0;
  v_suspicious             bigint := 0;
  v_malicious              bigint := 0;
  v_failed                 bigint := 0;
  v_unscanned              bigint := 0;
  v_download_auth_24h      bigint := 0;
  v_last_download_auth_at  timestamptz;
BEGIN
  -- Aggregate registered files scoped to the resource-packages bucket only.
  SELECT
    count(*),
    coalesce(sum(size_bytes), 0),
    count(*) FILTER (
      WHERE checksum_sha256 IS NOT NULL
        AND checksum_sha256 ~ '^[a-f0-9]{64}$'
    ),
    max(created_at)
  INTO
    v_registered_files, v_registered_bytes, v_checksum_ready_files, v_last_registered_at
  FROM public.resource_files
  WHERE storage_bucket = 'resource-packages';

  -- Latest scan status per resource_version_id, then count files by that
  -- version's latest scan status. Files without a scan row count as unscanned.
  -- Buckets are mutually exclusive and sum exactly to v_registered_files.
  WITH latest AS (
    SELECT DISTINCT ON (ps.resource_version_id)
      ps.resource_version_id,
      ps.status
    FROM public.package_scans ps
    ORDER BY ps.resource_version_id, ps.created_at DESC
  ),
  joined AS (
    SELECT rf.id, l.status
    FROM public.resource_files rf
    LEFT JOIN latest l ON l.resource_version_id = rf.resource_version_id
    WHERE rf.storage_bucket = 'resource-packages'
  )
  SELECT
    count(*) FILTER (WHERE status = 'clean'::public.v2_scan_status),
    count(*) FILTER (WHERE status = 'pending'::public.v2_scan_status),
    count(*) FILTER (WHERE status = 'suspicious'::public.v2_scan_status),
    count(*) FILTER (WHERE status = 'malicious'::public.v2_scan_status),
    count(*) FILTER (WHERE status = 'failed'::public.v2_scan_status),
    count(*) FILTER (WHERE status IS NULL)
  INTO
    v_clean, v_pending, v_suspicious, v_malicious, v_failed, v_unscanned
  FROM joined;

  -- Aggregate download authorizations from the last 24h and the last
  -- download_authorized event ever recorded.
  SELECT count(*)
  INTO v_download_auth_24h
  FROM public.activity_events
  WHERE action = 'download_authorized'
    AND created_at >= now() - interval '24 hours';

  SELECT max(created_at)
  INTO v_last_download_auth_at
  FROM public.activity_events
  WHERE action = 'download_authorized';

  RETURN jsonb_build_object(
    'as_of', now(),
    'registered_files', v_registered_files,
    'registered_bytes', v_registered_bytes,
    'checksum_ready_files', v_checksum_ready_files,
    'last_registered_at', v_last_registered_at,
    'scan_counts', jsonb_build_object(
      'clean', v_clean,
      'pending', v_pending,
      'suspicious', v_suspicious,
      'malicious', v_malicious,
      'failed', v_failed,
      'unscanned', v_unscanned
    ),
    'downloads', jsonb_build_object(
      'authorized_24h', v_download_auth_24h,
      'last_authorized_at', v_last_download_auth_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_admin_storage_settings_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_internal_admin_storage_settings_summary() FROM anon;
REVOKE ALL ON FUNCTION public.v2_internal_admin_storage_settings_summary() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_admin_storage_settings_summary() TO service_role;
