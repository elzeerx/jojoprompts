-- =============================================================================
-- PROMOTED — this draft has been promoted to the forward-only migration
--   supabase/migrations/20260728143000_package_scan_fail_closed_effective_state.sql
-- The migration file is the authoritative source of truth. This draft is kept
-- as an unchanged historical copy to preserve the review trail. Do NOT edit
-- this file in isolation — any change must be applied to the promoted
-- migration in the same commit to avoid divergence. Static contract tests
-- target the promoted migration path.
--
-- Phase 6 fail-closed hardening: single effective-scan-state source of truth
-- for authorize_resource_download, public trust badges, and admin scan queue.
-- Forward-only. No data mutations. All privileged helpers service_role only.
-- =============================================================================


-- 1) v2_internal_effective_scan_state(version_id) --------------------------------
-- Returns coverage-aware scan state. Effective clean requires the latest stored
-- clean scan's package_scan_items to be an EXACT set match for the version's
-- current resource_files (distinct on both sides — no duplicate-item trick), and
-- every one of those items to be clean. Any drift => effective 'unscanned'.
CREATE OR REPLACE FUNCTION public.v2_internal_effective_scan_state(
  p_version_id uuid
) RETURNS TABLE (
  has_files            boolean,
  latest_scan_id       uuid,
  stored_status        text,
  effective_status     text,
  coverage_valid       boolean,
  latest_scanned_at    timestamptz,
  latest_created_at    timestamptz,
  latest_completed_at  timestamptz,
  current_file_count   int,
  scanned_file_count   int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_files int := 0;
  v_latest_id uuid;
  v_latest_status public.v2_scan_status;
  v_latest_scanned timestamptz;
  v_latest_created timestamptz;
  v_latest_completed timestamptz;
  v_scanned_files int := 0;
  v_items_all_clean boolean := false;
  v_coverage boolean := false;
  v_effective text;
BEGIN
  IF p_version_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT rf.id)::int INTO v_current_files
    FROM public.resource_files rf
   WHERE rf.resource_version_id = p_version_id;

  -- Latest scan attempt (any status). created_at monotonic; scanned_at is only
  -- a tiebreaker so a newer pending scan overrides an older clean scan.
  SELECT s.id, s.status, s.scanned_at, s.created_at, s.completed_at
    INTO v_latest_id, v_latest_status, v_latest_scanned, v_latest_created, v_latest_completed
    FROM public.package_scans s
   WHERE s.resource_version_id = p_version_id
   ORDER BY s.created_at DESC, s.scanned_at DESC NULLS LAST, s.id DESC
   LIMIT 1;

  IF v_current_files = 0 THEN
    v_effective := 'unscanned';
    RETURN QUERY SELECT
      false, v_latest_id,
      COALESCE(v_latest_status::text, 'unscanned'),
      v_effective, false,
      v_latest_scanned, v_latest_created, v_latest_completed,
      0, 0;
    RETURN;
  END IF;

  IF v_latest_id IS NULL THEN
    v_effective := 'unscanned';
    RETURN QUERY SELECT
      true, NULL::uuid, 'unscanned', v_effective, false,
      NULL::timestamptz, NULL::timestamptz, NULL::timestamptz,
      v_current_files, 0;
    RETURN;
  END IF;

  IF v_latest_status = 'clean' THEN
    -- DISTINCT scan items defeat duplicate-item count tricks. Every currently
    -- present resource_file must appear exactly once in the clean scan, no
    -- extras, no missing items, all clean.
    SELECT
      count(*) FILTER (
        WHERE psi.resource_file_id IN (
          SELECT rf.id FROM public.resource_files rf
           WHERE rf.resource_version_id = p_version_id
        )
      ),
      bool_and(psi.status = 'clean')
      INTO v_scanned_files, v_items_all_clean
      FROM (
        SELECT DISTINCT ON (resource_file_id) resource_file_id, status
          FROM public.package_scan_items
         WHERE package_scan_id = v_latest_id
           AND resource_file_id IS NOT NULL
         ORDER BY resource_file_id, id
      ) psi;

    v_coverage :=
      COALESCE(v_items_all_clean, false)
      AND v_scanned_files = v_current_files
      AND (
        SELECT count(*) = v_current_files
          FROM (
            SELECT DISTINCT resource_file_id
              FROM public.package_scan_items
             WHERE package_scan_id = v_latest_id
               AND resource_file_id IS NOT NULL
          ) x
      );

    v_effective := CASE WHEN v_coverage THEN 'clean' ELSE 'unscanned' END;
  ELSE
    v_effective := COALESCE(v_latest_status::text, 'unscanned');
    v_coverage := false;
    SELECT count(DISTINCT resource_file_id)::int INTO v_scanned_files
      FROM public.package_scan_items
     WHERE package_scan_id = v_latest_id
       AND resource_file_id IS NOT NULL;
  END IF;

  RETURN QUERY SELECT
    true, v_latest_id,
    COALESCE(v_latest_status::text, 'unscanned'),
    v_effective, v_coverage,
    v_latest_scanned, v_latest_created, v_latest_completed,
    v_current_files, COALESCE(v_scanned_files, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_effective_scan_state(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_internal_effective_scan_state(uuid) TO service_role;

COMMENT ON FUNCTION public.v2_internal_effective_scan_state(uuid) IS
  'Single source of truth for coverage-aware scan trust state. Effective clean requires exact set match between the latest stored clean scan''s distinct package_scan_items and the version''s current resource_files, with every item clean. Any drift => effective unscanned. Service-role only.';

-- 2) authorize_resource_download(uuid, uuid) — service-only overload ------------
CREATE OR REPLACE FUNCTION public.authorize_resource_download(p_file_id uuid, p_user_id uuid)
RETURNS TABLE (storage_bucket text, storage_path text, file_name text, content_type text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_res uuid; v_major int; v_ver uuid; v_ck text;
  v_eff record;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT rv.resource_id, rv.major_version, rv.id
    INTO v_res, v_major, v_ver
    FROM public.resource_files rf
    JOIN public.resource_versions rv ON rv.id = rf.resource_version_id
   WHERE rf.id = p_file_id;

  IF v_res IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  v_ck := public.v2_resource_collection_key(v_res);

  IF NOT EXISTS (
    SELECT 1 FROM public.entitlements e
     WHERE e.user_id = p_user_id
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > now())
       AND (
         e.scope = 'library'::public.v2_entitlement_scope
         OR (e.scope = 'resource'::public.v2_entitlement_scope
             AND e.resource_id = v_res
             AND (e.version_major IS NULL OR e.version_major = v_major))
         OR (e.scope = 'collection'::public.v2_entitlement_scope
             AND v_ck IS NOT NULL AND e.collection_key = v_ck)
       )
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_eff FROM public.v2_internal_effective_scan_state(v_ver);

  IF v_eff.effective_status <> 'clean' OR NOT v_eff.coverage_valid THEN
    RAISE EXCEPTION 'package unavailable' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.package_scan_items psi
     WHERE psi.package_scan_id = v_eff.latest_scan_id
       AND psi.resource_file_id = p_file_id
       AND psi.status = 'clean'
  ) THEN
    RAISE EXCEPTION 'package unavailable' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT rf.storage_bucket, rf.storage_path, rf.file_name, rf.content_type
      FROM public.resource_files rf WHERE rf.id = p_file_id;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_resource_download(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.authorize_resource_download(uuid, uuid) TO service_role;

-- 3) authorize_resource_download(uuid) — auth.uid() overload --------------------
CREATE OR REPLACE FUNCTION public.authorize_resource_download(p_file_id uuid)
RETURNS TABLE (storage_bucket text, storage_path text, file_name text, content_type text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_res uuid; v_major int; v_ver uuid; v_ck text;
  v_eff record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT rv.resource_id, rv.major_version, rv.id
    INTO v_res, v_major, v_ver
    FROM public.resource_files rf
    JOIN public.resource_versions rv ON rv.id = rf.resource_version_id
   WHERE rf.id = p_file_id;

  IF v_res IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  v_ck := public.v2_resource_collection_key(v_res);

  IF NOT EXISTS (
    SELECT 1 FROM public.entitlements e
     WHERE e.user_id = v_user
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > now())
       AND (
         e.scope = 'library'::public.v2_entitlement_scope
         OR (e.scope = 'resource'::public.v2_entitlement_scope
             AND e.resource_id = v_res
             AND (e.version_major IS NULL OR e.version_major = v_major))
         OR (e.scope = 'collection'::public.v2_entitlement_scope
             AND v_ck IS NOT NULL AND e.collection_key = v_ck)
       )
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_eff FROM public.v2_internal_effective_scan_state(v_ver);

  IF v_eff.effective_status <> 'clean' OR NOT v_eff.coverage_valid THEN
    RAISE EXCEPTION 'package unavailable' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.package_scan_items psi
     WHERE psi.package_scan_id = v_eff.latest_scan_id
       AND psi.resource_file_id = p_file_id
       AND psi.status = 'clean'
  ) THEN
    RAISE EXCEPTION 'package unavailable' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT rf.storage_bucket, rf.storage_path, rf.file_name, rf.content_type
      FROM public.resource_files rf WHERE rf.id = p_file_id;
END;
$$;

-- Preserve the authoritative ACL from migration 20260723122822: the one-arg
-- overload must NEVER be reachable from the browser. The frontend goes through
-- the resource-download Edge Function; only service_role (the Edge Function's
-- SUPABASE_SERVICE_ROLE_KEY client) may execute it.
REVOKE ALL ON FUNCTION public.authorize_resource_download(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.authorize_resource_download(uuid) TO service_role;

-- 4) get_public_resource_trust_badges — derives from effective state ------------
CREATE OR REPLACE FUNCTION public.get_public_resource_trust_badges(
  resource_ids uuid[] DEFAULT NULL
) RETURNS TABLE (
  resource_id  uuid,
  version_id   uuid,
  scan_status  text,
  scanned_at   timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id                             AS resource_id,
    rv.id                            AS version_id,
    eff.effective_status             AS scan_status,
    CASE WHEN eff.effective_status = 'clean' AND eff.coverage_valid
         THEN eff.latest_scanned_at ELSE NULL END AS scanned_at
  FROM public.resources r
  JOIN public.resource_versions rv
    ON rv.id = r.current_version_id AND rv.resource_id = r.id
  CROSS JOIN LATERAL public.v2_internal_effective_scan_state(rv.id) eff
  WHERE r.lifecycle = 'published'
    AND (resource_ids IS NULL OR r.id = ANY(resource_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_resource_trust_badges(uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_public_resource_trust_badges(uuid[]) TO anon, authenticated;

-- 5) v2_admin_list_package_scan_queue — effective-state driven ------------------
CREATE OR REPLACE FUNCTION public.v2_admin_list_package_scan_queue(
  p_states text[] DEFAULT NULL::text[],
  p_search text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_valid constant text[] :=
    ARRAY['unscanned','pending','clean','suspicious','malicious','failed'];
  v_states text[] := p_states;
  v_limit int := COALESCE(p_limit, 50);
  v_offset int := COALESCE(p_offset, 0);
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_rows jsonb;
  v_total_count int;
  v_summary jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_states IS NOT NULL THEN
    IF array_length(v_states, 1) IS NULL OR EXISTS (
      SELECT 1 FROM unnest(v_states) s
       WHERE s IS NULL OR NOT (s = ANY (v_valid))
    ) THEN
      RAISE EXCEPTION 'invalid_state_filter' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_limit < 1 OR v_limit > 200 OR v_offset < 0 THEN
    RAISE EXCEPTION 'invalid_pagination' USING ERRCODE = '22023';
  END IF;

  WITH base AS (
    SELECT
      rv.id AS version_id, rv.resource_id, r.slug,
      r.type::text AS resource_type, r.lifecycle::text AS lifecycle,
      r.title_en, r.title_ar, rv.version, rv.major_version, rv.is_current,
      rv.updated_at, rv.package_size_bytes,
      (rv.package_checksum IS NOT NULL) AS package_checksum_present,
      eff.current_file_count            AS file_count,
      eff.latest_scan_id,
      eff.effective_status              AS latest_scan_status,
      eff.stored_status                 AS stored_status,
      eff.coverage_valid,
      ls.scanner AS latest_scanner,
      eff.latest_scanned_at,
      eff.latest_created_at             AS latest_scan_created_at,
      COALESCE(
        CASE
          WHEN ls.findings IS NULL THEN 0
          WHEN jsonb_typeof(ls.findings) = 'array' THEN jsonb_array_length(ls.findings)
          WHEN jsonb_typeof(ls.findings) = 'object'
            THEN (SELECT count(*)::int FROM jsonb_object_keys(ls.findings))
          ELSE 0
        END, 0)::int AS findings_count
    FROM public.resource_versions rv
    JOIN public.resources r ON r.id = rv.resource_id
    CROSS JOIN LATERAL public.v2_internal_effective_scan_state(rv.id) eff
    LEFT JOIN public.package_scans ls ON ls.id = eff.latest_scan_id
    WHERE eff.has_files
  ),
  filtered AS (
    SELECT * FROM base
     WHERE (v_states IS NULL OR latest_scan_status = ANY (v_states))
       AND (
         v_search IS NULL
         OR slug ILIKE '%'||v_search||'%'
         OR version ILIKE '%'||v_search||'%'
         OR title_en ILIKE '%'||v_search||'%'
         OR COALESCE(title_ar,'') ILIKE '%'||v_search||'%'
         OR COALESCE(latest_scanner,'') ILIKE '%'||v_search||'%'
       )
  ),
  ranked AS (
    SELECT *,
      CASE latest_scan_status
        WHEN 'malicious' THEN 0 WHEN 'suspicious' THEN 1
        WHEN 'failed' THEN 2   WHEN 'unscanned' THEN 3
        WHEN 'pending' THEN 4  WHEN 'clean' THEN 5
        ELSE 6 END AS attention_rank,
      COALESCE(latest_scanned_at, latest_scan_created_at, updated_at) AS sort_ts
    FROM filtered
  ),
  paged AS (
    SELECT * FROM ranked
     ORDER BY attention_rank ASC, sort_ts DESC NULLS LAST, version_id DESC
     LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT count(*)::int FROM filtered),
    COALESCE(jsonb_agg(jsonb_build_object(
      'version_id', paged.version_id, 'resource_id', paged.resource_id,
      'slug', paged.slug, 'resource_type', paged.resource_type,
      'lifecycle', paged.lifecycle, 'title_en', paged.title_en,
      'title_ar', paged.title_ar, 'version', paged.version,
      'major_version', paged.major_version, 'is_current', paged.is_current,
      'file_count', paged.file_count, 'package_size_bytes', paged.package_size_bytes,
      'package_checksum_present', paged.package_checksum_present,
      'latest_scan_id', paged.latest_scan_id,
      'latest_scan_status', paged.latest_scan_status,
      'stored_scan_status', paged.stored_status,
      'coverage_valid', paged.coverage_valid,
      'latest_scanner', paged.latest_scanner,
      'latest_scanned_at', paged.latest_scanned_at,
      'latest_scan_created_at', paged.latest_scan_created_at,
      'findings_count', paged.findings_count,
      'updated_at', paged.updated_at
    ) ORDER BY paged.attention_rank ASC, paged.sort_ts DESC NULLS LAST, paged.version_id DESC),
    '[]'::jsonb)
  INTO v_total_count, v_rows
  FROM paged;

  WITH latest AS (
    SELECT eff.effective_status AS s
      FROM public.resource_versions rv
      CROSS JOIN LATERAL public.v2_internal_effective_scan_state(rv.id) eff
     WHERE eff.has_files
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
    'limit', v_limit, 'offset', v_offset,
    'rows', v_rows, 'summary', v_summary
  );
END;
$$;

REVOKE ALL ON FUNCTION public.v2_admin_list_package_scan_queue(text[], text, integer, integer) FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.v2_admin_list_package_scan_queue(text[], text, integer, integer) TO authenticated;

-- 6) Published-version file immutability trigger --------------------------------
CREATE OR REPLACE FUNCTION public.v2_enforce_published_file_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_published timestamptz;
  v_new_published timestamptz;
BEGIN
  -- INSERT: only NEW exists — reject if NEW's version is published.
  -- DELETE: only OLD exists — reject if OLD's version is published.
  -- UPDATE: BOTH OLD and NEW must be checked so a file cannot be moved into
  --         a published version, out of a published version, or mutated in
  --         place under a published version.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT published_at INTO v_old_published FROM public.resource_versions
     WHERE id = OLD.resource_version_id;
    IF v_old_published IS NOT NULL THEN
      RAISE EXCEPTION 'published_version_immutable' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT published_at INTO v_new_published FROM public.resource_versions
     WHERE id = NEW.resource_version_id;
    IF v_new_published IS NOT NULL THEN
      RAISE EXCEPTION 'published_version_immutable' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_enforce_published_file_immutability() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_enforce_published_file_immutability() TO service_role;

DROP TRIGGER IF EXISTS resource_files_published_immutable ON public.resource_files;
CREATE TRIGGER resource_files_published_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON public.resource_files
  FOR EACH ROW EXECUTE FUNCTION public.v2_enforce_published_file_immutability();

COMMENT ON TRIGGER resource_files_published_immutable ON public.resource_files IS
  'Rejects file mutations when the referenced resource_versions row is published. Admins must create a new draft version to alter a published package. Draft versions remain freely editable. Stable error: published_version_immutable.';

-- 7) v2_admin_get_resource_version_detail — expose effective_scan --------------
-- The admin detail RPC is the ONLY signal the ScanDetailSheet reads. It must
-- surface the coverage-aware effective scan state so the frontend Queue guard
-- can (a) treat exact-coverage clean as already_clean and (b) treat stale
-- clean as re-queuable, both from the same authoritative helper the
-- authorization path uses. This is a forward-only CREATE OR REPLACE; the
-- original definition in migration 20260724165802 is superseded intact.
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
  v_eff record;
  v_effective_scan jsonb;
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

  -- Single source of truth for coverage-aware trust. Because this function is
  -- SECURITY DEFINER and owned by the DB owner, it can invoke the
  -- service_role-only helper without exposing it to the caller.
  SELECT
    has_files, latest_scan_id, stored_status, effective_status, coverage_valid,
    current_file_count, scanned_file_count, latest_created_at, latest_scanned_at
  INTO v_eff
  FROM public.v2_internal_effective_scan_state(p_version_id);

  v_effective_scan := jsonb_build_object(
    'has_files',           v_eff.has_files,
    'latest_scan_id',      v_eff.latest_scan_id,
    'stored_status',       v_eff.stored_status,
    'effective_status',    v_eff.effective_status,
    'coverage_valid',      v_eff.coverage_valid,
    'current_file_count',  v_eff.current_file_count,
    'scanned_file_count',  v_eff.scanned_file_count,
    'latest_created_at',   v_eff.latest_created_at,
    'latest_scanned_at',   v_eff.latest_scanned_at
  );

  RETURN jsonb_build_object(
    'version', v_version,
    'files', v_files,
    'scans', v_scans,
    'effective_scan', v_effective_scan
  );
END;
$fn$;

-- Preserve authoritative ACL from migration 20260724165802.
REVOKE ALL ON FUNCTION public.v2_admin_get_resource_version_detail(uuid) FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION public.v2_admin_get_resource_version_detail(uuid) TO authenticated;

-- =============================================================================
-- 8) v2_internal_create_package_scan — atomic authority using effective helper
-- =============================================================================
-- The historical definition (migration 20260724182504) computed already_clean
-- by locating the latest CLEAN scan and re-deriving exact coverage inline. That
-- meant: after an older exact-current clean scan, if a later scan reported
-- failed/suspicious/malicious, the create-scan RPC would still reject
-- 'already_clean' by walking back to the older clean row — while the edge
-- preflight (which uses effective_status of the LATEST attempt) correctly
-- allowed a retry. The two paths disagreed, blocking legitimate retries.
--
-- This forward-only replacement makes v2_internal_effective_scan_state the
-- single source of truth for already_clean and adds a row-level lock on the
-- target resource_versions row so concurrent queue attempts serialize cleanly.
-- Pending-child rejection covers ANY package_scan_items row still pending
-- under ANY scan for the version (terminal aggregate with pending child
-- included). Unique-violation fallback and service_role-only ACL preserved.
CREATE OR REPLACE FUNCTION public.v2_internal_create_package_scan(
  p_version_id uuid,
  p_scanner text,
  p_requested_by uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scan_id uuid;
  v_version_id uuid;
  v_eff record;
BEGIN
  -- 1) Validate arguments
  IF p_version_id IS NULL OR p_scanner IS NULL OR btrim(p_scanner) = '' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  -- 2) Serialize concurrent queue attempts on the same version by locking the
  --    resource_versions row FOR UPDATE. Missing version -> stable error.
  SELECT id INTO v_version_id
    FROM public.resource_versions
   WHERE id = p_version_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'version_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 3) Verify current files exist
  IF NOT EXISTS (
    SELECT 1 FROM public.resource_files
     WHERE resource_version_id = p_version_id
  ) THEN
    RAISE EXCEPTION 'no_files' USING ERRCODE = '22023';
  END IF;

  -- 4) pending_exists: ANY pending package_scan_items row under ANY scan for
  --    this version (covers terminal aggregate with recoverable pending child).
  IF EXISTS (
    SELECT 1
      FROM public.package_scan_items psi
      JOIN public.package_scans ps ON ps.id = psi.package_scan_id
     WHERE ps.resource_version_id = p_version_id
       AND psi.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'pending_exists' USING ERRCODE = '23505';
  END IF;

  -- 5) already_clean — SINGLE source of truth. Do NOT duplicate exact-coverage
  --    SQL here; delegate to v2_internal_effective_scan_state. Reject only
  --    when the latest effective_status is 'clean' AND coverage_valid=true.
  SELECT effective_status, coverage_valid
    INTO v_eff
    FROM public.v2_internal_effective_scan_state(p_version_id);
  IF v_eff.effective_status = 'clean' AND COALESCE(v_eff.coverage_valid, false) THEN
    RAISE EXCEPTION 'already_clean' USING ERRCODE = '23505';
  END IF;

  -- 6) Create one pending scan + one pending item per current file.
  BEGIN
    INSERT INTO public.package_scans (
      resource_version_id, scanner, status, findings,
      requested_by, requested_at, attempt_count
    ) VALUES (
      p_version_id, p_scanner, 'pending', '{}'::jsonb,
      p_requested_by, now(), 0
    ) RETURNING id INTO v_scan_id;
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent queue race collided with the partial-unique pending index.
    RAISE EXCEPTION 'pending_exists' USING ERRCODE = '23505';
  END;

  INSERT INTO public.package_scan_items (
    package_scan_id, resource_file_id, status, progress
  )
  SELECT v_scan_id, rf.id, 'pending', 0
    FROM public.resource_files rf
   WHERE rf.resource_version_id = p_version_id;

  RETURN v_scan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_create_package_scan(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_internal_create_package_scan(uuid, text, uuid) TO service_role;
