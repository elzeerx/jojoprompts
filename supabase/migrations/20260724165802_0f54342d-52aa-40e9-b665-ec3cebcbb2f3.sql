-- Phase 6C: Admin Versions Registry — read-only RPCs

CREATE OR REPLACE FUNCTION public.v2_admin_list_resource_versions(
  p_types text[] DEFAULT NULL,
  p_scan_states text[] DEFAULT NULL,
  p_current text DEFAULT 'all',
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_valid_types constant text[] := ARRAY['skill','automation','prompt','prompt_pack','image_style','bundle'];
  v_valid_scans constant text[] := ARRAY['pending','clean','suspicious','malicious','failed','unscanned'];
  v_valid_current constant text[] := ARRAY['all','current','historical'];
  v_types text[] := p_types;
  v_scans text[] := p_scan_states;
  v_current text := COALESCE(p_current, 'all');
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

  IF v_types IS NOT NULL THEN
    IF array_length(v_types, 1) IS NULL OR EXISTS (
      SELECT 1 FROM unnest(v_types) t WHERE t IS NULL OR NOT (t = ANY (v_valid_types))
    ) THEN
      RAISE EXCEPTION 'invalid_type_filter' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_scans IS NOT NULL THEN
    IF array_length(v_scans, 1) IS NULL OR EXISTS (
      SELECT 1 FROM unnest(v_scans) s WHERE s IS NULL OR NOT (s = ANY (v_valid_scans))
    ) THEN
      RAISE EXCEPTION 'invalid_scan_filter' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NOT (v_current = ANY (v_valid_current)) THEN
    RAISE EXCEPTION 'invalid_current_filter' USING ERRCODE = '22023';
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
      rv.published_at,
      rv.updated_at,
      rv.package_size_bytes,
      (rv.package_checksum IS NOT NULL) AS package_checksum_present,
      (SELECT count(*)::int FROM public.resource_files rf WHERE rf.resource_version_id = rv.id) AS file_count,
      (SELECT count(*)::int FROM public.package_scans ps WHERE ps.resource_version_id = rv.id) AS scan_count,
      ls.status::text AS latest_scan_status,
      ls.scanner AS latest_scanner,
      ls.scanned_at AS latest_scanned_at
    FROM public.resource_versions rv
    JOIN public.resources r ON r.id = rv.resource_id
    LEFT JOIN LATERAL (
      SELECT ps.status, ps.scanner, ps.scanned_at
      FROM public.package_scans ps
      WHERE ps.resource_version_id = rv.id
      ORDER BY COALESCE(ps.scanned_at, ps.created_at) DESC, ps.created_at DESC
      LIMIT 1
    ) ls ON true
  ), filtered AS (
    SELECT * FROM base
    WHERE (v_types IS NULL OR resource_type = ANY (v_types))
      AND (
        v_scans IS NULL
        OR (latest_scan_status IS NOT NULL AND latest_scan_status = ANY (v_scans))
        OR (latest_scan_status IS NULL AND 'unscanned' = ANY (v_scans))
      )
      AND (
        v_current = 'all'
        OR (v_current = 'current' AND is_current)
        OR (v_current = 'historical' AND NOT is_current)
      )
      AND (
        v_search IS NULL
        OR slug ILIKE '%' || v_search || '%'
        OR version ILIKE '%' || v_search || '%'
        OR title_en ILIKE '%' || v_search || '%'
        OR COALESCE(title_ar,'') ILIKE '%' || v_search || '%'
      )
  ), paged AS (
    SELECT * FROM filtered
    ORDER BY updated_at DESC, version_id
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT count(*)::int FROM filtered),
    COALESCE(jsonb_agg(to_jsonb(paged.*) ORDER BY paged.updated_at DESC, paged.version_id), '[]'::jsonb)
  INTO v_total_count, v_rows
  FROM paged;

  SELECT jsonb_build_object(
    'total_versions', (SELECT count(*)::int FROM public.resource_versions),
    'current_versions', (SELECT count(*)::int FROM public.resource_versions WHERE is_current),
    'versions_with_files', (SELECT count(DISTINCT rf.resource_version_id)::int FROM public.resource_files rf),
    'unscanned_versions', (
      SELECT count(*)::int FROM public.resource_versions rv
      WHERE NOT EXISTS (SELECT 1 FROM public.package_scans ps WHERE ps.resource_version_id = rv.id)
    ),
    'scan_attention', (
      SELECT count(*)::int FROM public.resource_versions rv
      WHERE EXISTS (
        SELECT 1 FROM (
          SELECT ps.status FROM public.package_scans ps
          WHERE ps.resource_version_id = rv.id
          ORDER BY COALESCE(ps.scanned_at, ps.created_at) DESC, ps.created_at DESC
          LIMIT 1
        ) x WHERE x.status IN ('suspicious','malicious','failed')
      )
    )
  ) INTO v_summary;

  RETURN jsonb_build_object(
    'total_count', v_total_count,
    'limit', v_limit,
    'offset', v_offset,
    'rows', v_rows,
    'summary', v_summary
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.v2_admin_list_resource_versions(text[], text[], text, text, int, int) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_list_resource_versions(text[], text[], text, text, int, int) TO authenticated;


CREATE OR REPLACE FUNCTION public.v2_admin_get_resource_version_detail(
  p_version_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_version jsonb;
  v_files jsonb;
  v_scans jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_version_id IS NULL THEN
    RAISE EXCEPTION 'invalid_version' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'version_id', rv.id,
    'resource_id', r.id,
    'slug', r.slug,
    'resource_type', r.type::text,
    'lifecycle', r.lifecycle::text,
    'title_en', r.title_en,
    'title_ar', r.title_ar,
    'version', rv.version,
    'major_version', rv.major_version,
    'is_current', rv.is_current,
    'published_at', rv.published_at,
    'created_at', rv.created_at,
    'updated_at', rv.updated_at,
    'changelog_en', rv.changelog_en,
    'changelog_ar', rv.changelog_ar,
    'package_size_bytes', rv.package_size_bytes,
    'package_checksum', rv.package_checksum
  )
  INTO v_version
  FROM public.resource_versions rv
  JOIN public.resources r ON r.id = rv.resource_id
  WHERE rv.id = p_version_id;

  IF v_version IS NULL THEN
    RAISE EXCEPTION 'version_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', rf.id,
    'file_name', rf.file_name,
    'content_type', rf.content_type,
    'size_bytes', rf.size_bytes,
    'checksum_sha256', rf.checksum_sha256,
    'created_at', rf.created_at
  ) ORDER BY rf.created_at DESC), '[]'::jsonb)
  INTO v_files
  FROM (
    SELECT * FROM public.resource_files
    WHERE resource_version_id = p_version_id
    ORDER BY created_at DESC
    LIMIT 200
  ) rf;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ps.id,
    'scanner', ps.scanner,
    'status', ps.status::text,
    'findings', ps.findings,
    'scanned_at', ps.scanned_at,
    'created_at', ps.created_at
  ) ORDER BY COALESCE(ps.scanned_at, ps.created_at) DESC), '[]'::jsonb)
  INTO v_scans
  FROM (
    SELECT * FROM public.package_scans
    WHERE resource_version_id = p_version_id
    ORDER BY COALESCE(scanned_at, created_at) DESC, created_at DESC
    LIMIT 50
  ) ps;

  RETURN jsonb_build_object(
    'version', v_version,
    'files', v_files,
    'scans', v_scans
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.v2_admin_get_resource_version_detail(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.v2_admin_get_resource_version_detail(uuid) TO authenticated;