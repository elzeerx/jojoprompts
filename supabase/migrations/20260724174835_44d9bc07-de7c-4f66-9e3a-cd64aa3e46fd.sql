-- Phase 6E1 — Package Scans Queue & History (provider-neutral, read-only)
-- Idempotent re-application to align repo with the already-applied live definition.

CREATE OR REPLACE FUNCTION public.v2_admin_list_package_scan_queue(
  p_states text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit  int    DEFAULT 50,
  p_offset int    DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_valid_states constant text[] :=
    ARRAY['unscanned','pending','clean','suspicious','malicious','failed'];
  v_states text[] := p_states;
  v_limit int := COALESCE(p_limit, 50);
  v_offset int := COALESCE(p_offset, 0);
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_rows jsonb;
  v_total_count int;
  v_summary jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_states IS NOT NULL THEN
    IF array_length(v_states, 1) IS NULL OR EXISTS (
      SELECT 1 FROM unnest(v_states) s
      WHERE s IS NULL OR NOT (s = ANY (v_valid_states))
    ) THEN
      RAISE EXCEPTION 'invalid_state_filter' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_limit < 1 OR v_limit > 200 OR v_offset < 0 THEN
    RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023';
  END IF;

  WITH base AS (
    SELECT
      rv.id AS version_id,
      rv.resource_id,
      r.slug,
      r.type::text AS resource_type,
      r.lifecycle::text AS lifecycle,
      r.title_en,
      r.title_ar,
      rv.version,
      rv.major_version,
      rv.is_current,
      rv.updated_at,
      rv.package_size_bytes,
      (rv.package_checksum IS NOT NULL) AS package_checksum_present,
      (SELECT count(*)::int FROM public.resource_files rf
         WHERE rf.resource_version_id = rv.id) AS file_count,
      ls.id AS latest_scan_id,
      COALESCE(ls.status::text, 'unscanned') AS latest_scan_status,
      ls.scanner AS latest_scanner,
      ls.scanned_at AS latest_scanned_at,
      ls.created_at AS latest_scan_created_at,
      COALESCE(
        CASE
          WHEN ls.findings IS NULL THEN 0
          WHEN jsonb_typeof(ls.findings) = 'array' THEN jsonb_array_length(ls.findings)
          WHEN jsonb_typeof(ls.findings) = 'object' THEN
            (SELECT count(*)::int FROM jsonb_object_keys(ls.findings))
          ELSE 0
        END, 0)::int AS findings_count
    FROM public.resource_versions rv
    JOIN public.resources r ON r.id = rv.resource_id
    LEFT JOIN LATERAL (
      SELECT ps.id, ps.status, ps.scanner, ps.findings, ps.scanned_at, ps.created_at
      FROM public.package_scans ps
      WHERE ps.resource_version_id = rv.id
      ORDER BY COALESCE(ps.scanned_at, ps.created_at) DESC,
               ps.created_at DESC,
               ps.id DESC
      LIMIT 1
    ) ls ON true
    WHERE EXISTS (
      SELECT 1 FROM public.resource_files rf
      WHERE rf.resource_version_id = rv.id
    )
  ),
  filtered AS (
    SELECT * FROM base
    WHERE (v_states IS NULL OR latest_scan_status = ANY (v_states))
      AND (
        v_search IS NULL
        OR slug ILIKE '%' || v_search || '%'
        OR version ILIKE '%' || v_search || '%'
        OR title_en ILIKE '%' || v_search || '%'
        OR COALESCE(title_ar,'') ILIKE '%' || v_search || '%'
        OR COALESCE(latest_scanner,'') ILIKE '%' || v_search || '%'
      )
  ),
  ranked AS (
    SELECT
      *,
      CASE latest_scan_status
        WHEN 'malicious' THEN 0
        WHEN 'suspicious' THEN 1
        WHEN 'failed' THEN 2
        WHEN 'unscanned' THEN 3
        WHEN 'pending' THEN 4
        WHEN 'clean' THEN 5
        ELSE 6
      END AS attention_rank,
      COALESCE(latest_scanned_at, latest_scan_created_at, updated_at) AS sort_ts
    FROM filtered
  ),
  paged AS (
    SELECT
      version_id, resource_id, slug, resource_type, lifecycle,
      title_en, title_ar, version, major_version, is_current,
      file_count, package_size_bytes, package_checksum_present,
      latest_scan_id, latest_scan_status, latest_scanner,
      latest_scanned_at, latest_scan_created_at, findings_count, updated_at,
      attention_rank, sort_ts
    FROM ranked
    ORDER BY attention_rank ASC, sort_ts DESC NULLS LAST, version_id DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT count(*)::int FROM filtered),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'version_id', paged.version_id,
          'resource_id', paged.resource_id,
          'slug', paged.slug,
          'resource_type', paged.resource_type,
          'lifecycle', paged.lifecycle,
          'title_en', paged.title_en,
          'title_ar', paged.title_ar,
          'version', paged.version,
          'major_version', paged.major_version,
          'is_current', paged.is_current,
          'file_count', paged.file_count,
          'package_size_bytes', paged.package_size_bytes,
          'package_checksum_present', paged.package_checksum_present,
          'latest_scan_id', paged.latest_scan_id,
          'latest_scan_status', paged.latest_scan_status,
          'latest_scanner', paged.latest_scanner,
          'latest_scanned_at', paged.latest_scanned_at,
          'latest_scan_created_at', paged.latest_scan_created_at,
          'findings_count', paged.findings_count,
          'updated_at', paged.updated_at
        )
        ORDER BY paged.attention_rank ASC, paged.sort_ts DESC NULLS LAST, paged.version_id DESC
      ),
      '[]'::jsonb
    )
  INTO v_total_count, v_rows
  FROM paged;

  WITH with_files AS (
    SELECT rv.id
    FROM public.resource_versions rv
    WHERE EXISTS (
      SELECT 1 FROM public.resource_files rf
      WHERE rf.resource_version_id = rv.id
    )
  ),
  latest AS (
    SELECT
      wf.id AS version_id,
      COALESCE(ls.status::text, 'unscanned') AS s
    FROM with_files wf
    LEFT JOIN LATERAL (
      SELECT ps.status
      FROM public.package_scans ps
      WHERE ps.resource_version_id = wf.id
      ORDER BY COALESCE(ps.scanned_at, ps.created_at) DESC,
               ps.created_at DESC, ps.id DESC
      LIMIT 1
    ) ls ON true
  )
  SELECT jsonb_build_object(
    'total_with_files', (SELECT count(*)::int FROM latest),
    'unscanned',  (SELECT count(*)::int FROM latest WHERE s = 'unscanned'),
    'pending',    (SELECT count(*)::int FROM latest WHERE s = 'pending'),
    'clean',      (SELECT count(*)::int FROM latest WHERE s = 'clean'),
    'suspicious', (SELECT count(*)::int FROM latest WHERE s = 'suspicious'),
    'malicious',  (SELECT count(*)::int FROM latest WHERE s = 'malicious'),
    'failed',     (SELECT count(*)::int FROM latest WHERE s = 'failed')
  ) INTO v_summary;

  RETURN jsonb_build_object(
    'total_count', v_total_count,
    'limit', v_limit,
    'offset', v_offset,
    'rows', v_rows,
    'summary', v_summary
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.v2_admin_list_package_scan_queue(text[], text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_admin_list_package_scan_queue(text[], text, int, int) FROM anon;
REVOKE ALL ON FUNCTION public.v2_admin_list_package_scan_queue(text[], text, int, int) FROM service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_package_scan_queue(text[], text, int, int) TO authenticated;
