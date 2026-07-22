
-- ============================================================
-- Phase B: version-aware entitlements, free acquisition, library state
-- Additive only. No data changes to existing rows beyond safe defaults.
-- ============================================================

-- 1) SCHEMA ADDITIONS -------------------------------------------------------

ALTER TABLE public.resource_versions
  ADD COLUMN IF NOT EXISTS major_version integer;

-- Backfill: try to parse leading integer of `version` (e.g. "1", "1.0", "1.2.3", "v2.0")
UPDATE public.resource_versions
SET major_version = NULLIF(
  regexp_replace(coalesce(version,''), '^\s*v?([0-9]+).*$', '\1'),
  ''
)::int
WHERE major_version IS NULL;

-- Safe default of 1 for any rows we could not parse (V2 catalog is empty in practice)
UPDATE public.resource_versions
SET major_version = 1
WHERE major_version IS NULL;

ALTER TABLE public.resource_versions
  ALTER COLUMN major_version SET NOT NULL,
  ALTER COLUMN major_version SET DEFAULT 1,
  ADD CONSTRAINT resource_versions_major_positive
    CHECK (major_version >= 1);

CREATE INDEX IF NOT EXISTS resource_versions_resource_major_idx
  ON public.resource_versions (resource_id, major_version);

-- entitlements.version_major (nullable, semantics enforced by trigger)
ALTER TABLE public.entitlements
  ADD COLUMN IF NOT EXISTS version_major integer;

ALTER TABLE public.entitlements
  ADD CONSTRAINT entitlements_version_major_positive
    CHECK (version_major IS NULL OR version_major >= 1);

-- order_items snapshot columns
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS resource_version_id uuid
    REFERENCES public.resource_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS acquired_major_version integer;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_acquired_major_positive
    CHECK (acquired_major_version IS NULL OR acquired_major_version >= 1);

-- Semantics validation trigger for entitlements.version_major
-- - scope='library'       => version_major MUST be NULL
-- - scope='resource':
--     grant_reason IN ('purchase','free_acquisition') => version_major NOT NULL
--     grant_reason IN ('legacy_migration','admin_grant') => NULL is allowed
--        (nullable means "all versions of this one resource" — reserved for
--         explicit admin/legacy grants only)
--     grant_reason IN ('lifetime_purchase','lifetime_threshold') is INVALID
--        under scope='resource' (those are library-scope grants)
CREATE OR REPLACE FUNCTION public.v2_validate_entitlement_version_major()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.scope = 'library' THEN
    IF NEW.version_major IS NOT NULL THEN
      RAISE EXCEPTION 'library-scope entitlements must have version_major NULL' USING ERRCODE='check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- scope = 'resource'
  IF NEW.grant_reason IN ('lifetime_purchase','lifetime_threshold') THEN
    RAISE EXCEPTION 'lifetime grant_reason requires scope=library' USING ERRCODE='check_violation';
  END IF;

  IF NEW.grant_reason IN ('purchase','free_acquisition')
     AND NEW.version_major IS NULL THEN
    RAISE EXCEPTION 'resource-scope purchase/free_acquisition requires version_major' USING ERRCODE='check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS v2_entitlements_validate_version_major ON public.entitlements;
CREATE TRIGGER v2_entitlements_validate_version_major
  BEFORE INSERT OR UPDATE ON public.entitlements
  FOR EACH ROW EXECUTE FUNCTION public.v2_validate_entitlement_version_major();

-- Authorization lookup index (active per user/resource)
CREATE INDEX IF NOT EXISTS entitlements_active_lookup_idx
  ON public.entitlements (user_id, resource_id, scope)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS entitlements_active_library_idx
  ON public.entitlements (user_id)
  WHERE revoked_at IS NULL AND scope = 'library';


-- 2) FREE ACQUISITION RPC ---------------------------------------------------

CREATE OR REPLACE FUNCTION public.grant_free_acquisition(p_resource_id uuid)
RETURNS TABLE (
  entitlement_id uuid,
  resource_id    uuid,
  version_major  integer,
  already_owned  boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_ver_id    uuid;
  v_major     integer;
  v_ent_id    uuid;
  v_existed   boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  -- Validate resource is published AND has an active free product for THIS resource.
  SELECT rv.id, rv.major_version
    INTO v_ver_id, v_major
  FROM public.resources r
  JOIN public.resource_versions rv
    ON rv.id = r.current_version_id AND rv.resource_id = r.id
  WHERE r.id = p_resource_id
    AND r.lifecycle = 'published'
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.resource_id = r.id
        AND p.product_type = 'free'
        AND p.is_active = true
    );

  IF v_ver_id IS NULL THEN
    RAISE EXCEPTION 'resource not eligible for free acquisition' USING ERRCODE = '42501';
  END IF;

  -- Idempotent: return existing active resource entitlement if present.
  SELECT e.id INTO v_ent_id
  FROM public.entitlements e
  WHERE e.user_id = v_user
    AND e.resource_id = p_resource_id
    AND e.scope = 'resource'
    AND e.revoked_at IS NULL
    AND (e.expires_at IS NULL OR e.expires_at > now())
  LIMIT 1;

  IF v_ent_id IS NOT NULL THEN
    v_existed := true;
  ELSE
    -- Concurrency-safe insert; the partial unique index on
    -- (user_id, resource_id) WHERE revoked_at IS NULL protects us.
    BEGIN
      INSERT INTO public.entitlements
        (user_id, resource_id, scope, grant_reason, version_major, granted_at)
      VALUES
        (v_user, p_resource_id, 'resource', 'free_acquisition', v_major, now())
      RETURNING id INTO v_ent_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT e.id INTO v_ent_id
      FROM public.entitlements e
      WHERE e.user_id = v_user
        AND e.resource_id = p_resource_id
        AND e.scope = 'resource'
        AND e.revoked_at IS NULL
      LIMIT 1;
      v_existed := true;
    END;
  END IF;

  -- Server-side audit (never trust client audit writes)
  INSERT INTO public.activity_events
    (actor_user_id, actor_type, entity_type, entity_id, action, metadata)
  VALUES
    (v_user, 'user', 'entitlement', v_ent_id,
     CASE WHEN v_existed THEN 'free_acquisition_noop' ELSE 'free_acquisition_granted' END,
     jsonb_build_object('resource_id', p_resource_id, 'version_major', v_major));

  RETURN QUERY SELECT v_ent_id, p_resource_id, v_major, v_existed;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_free_acquisition(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_free_acquisition(uuid) TO authenticated;
COMMENT ON FUNCTION public.grant_free_acquisition(uuid) IS
  'Server-authoritative free acquisition. Requires auth.uid(). Idempotent per user/resource. Does not create a library entitlement — resource-scope only, so it survives lifetime-credit revocations.';


-- 3) LIBRARY STATE READ RPC --------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_library_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_progress integer;
  v_ents     jsonb;
  v_has_lib  boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT LEAST(GREATEST(COALESCE(SUM(amount_fils), 0), 0), 30000)::int
    INTO v_progress
  FROM public.lifetime_credit_entries
  WHERE user_id = v_user;

  SELECT EXISTS (
    SELECT 1 FROM public.entitlements e
    WHERE e.user_id = v_user
      AND e.scope = 'library'
      AND e.revoked_at IS NULL
      AND (e.expires_at IS NULL OR e.expires_at > now())
  ) INTO v_has_lib;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_ents
  FROM (
    SELECT
      e.id,
      e.resource_id,
      e.scope,
      e.grant_reason,
      e.version_major,
      e.granted_at,
      e.expires_at
    FROM public.entitlements e
    WHERE e.user_id = v_user
      AND e.revoked_at IS NULL
      AND (e.expires_at IS NULL OR e.expires_at > now())
    ORDER BY e.granted_at DESC
  ) x;

  RETURN jsonb_build_object(
    'entitlements', v_ents,
    'has_library_access', v_has_lib,
    'lifetime_progress_fils', v_progress,
    'lifetime_threshold_fils', 30000,
    'lifetime_remaining_fils', GREATEST(30000 - v_progress, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_library_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_library_state() TO authenticated;
COMMENT ON FUNCTION public.get_my_library_state() IS
  'Returns only the caller''s active entitlements plus capped lifetime progress and remaining fils. Never leaks other users, payment payloads, or storage paths.';


-- 4) DOWNLOAD AUTHORIZATION RPC (server-only helper) ------------------------

CREATE OR REPLACE FUNCTION public.authorize_resource_download(p_file_id uuid)
RETURNS TABLE (
  storage_bucket text,
  storage_path   text,
  file_name      text,
  content_type   text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_res   uuid;
  v_major integer;
  v_ver   uuid;
  v_scan  public.v2_scan_status;
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

  -- Authorization: active library entitlement OR active resource entitlement
  -- whose version_major is NULL (admin/legacy all-versions grant) or equals requested major.
  IF NOT EXISTS (
    SELECT 1 FROM public.entitlements e
    WHERE e.user_id = v_user
      AND e.revoked_at IS NULL
      AND (e.expires_at IS NULL OR e.expires_at > now())
      AND (
        e.scope = 'library'
        OR (
          e.scope = 'resource'
          AND e.resource_id = v_res
          AND (e.version_major IS NULL OR e.version_major = v_major)
        )
      )
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  -- Scan gate: only clean packages are downloadable.
  SELECT s.status INTO v_scan
  FROM public.package_scans s
  WHERE s.resource_version_id = v_ver
  ORDER BY s.scanned_at DESC NULLS LAST, s.created_at DESC
  LIMIT 1;

  IF v_scan IS NULL OR v_scan <> 'clean' THEN
    RAISE EXCEPTION 'package unavailable' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT rf.storage_bucket, rf.storage_path, rf.file_name, rf.content_type
    FROM public.resource_files rf
    WHERE rf.id = p_file_id;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_resource_download(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.authorize_resource_download(uuid) TO authenticated;
COMMENT ON FUNCTION public.authorize_resource_download(uuid) IS
  'Server-only authorization helper. Returns bucket/path only if caller has an entitlement covering the file''s version major AND the latest scan is clean. Non-enumerating errors.';
