
-- =====================================================================
-- Phase C: safe owner-read for archived resources + downloadable-files RPC
-- Additive only.
-- =====================================================================

-- Reusable predicate: does the current auth.uid() have an active, non-expired
-- entitlement that covers the given resource (library OR resource-scope)?
CREATE OR REPLACE FUNCTION public.v2_user_owns_resource(p_resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entitlements e
    WHERE e.user_id = auth.uid()
      AND e.revoked_at IS NULL
      AND (e.expires_at IS NULL OR e.expires_at > now())
      AND (
        e.scope = 'library'
        OR (e.scope = 'resource' AND e.resource_id = p_resource_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.v2_user_owns_resource(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_user_owns_resource(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.v2_user_owns_resource(uuid) TO authenticated, service_role;

-- 1) resources: owner may read archived rows they still own
CREATE POLICY "resources_owner_read_archived"
ON public.resources
FOR SELECT
TO authenticated
USING (
  lifecycle = 'archived'
  AND public.v2_user_owns_resource(id)
);

-- 2) resource_versions
CREATE POLICY "resource_versions_owner_read_archived"
ON public.resource_versions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = resource_versions.resource_id
      AND r.lifecycle = 'archived'
      AND public.v2_user_owns_resource(r.id)
  )
);

-- 3) platform_compatibility
CREATE POLICY "platform_compat_owner_read_archived"
ON public.platform_compatibility
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = platform_compatibility.resource_id
      AND r.lifecycle = 'archived'
      AND public.v2_user_owns_resource(r.id)
  )
);

-- 4) installation_guides
CREATE POLICY "install_guides_owner_read_archived"
ON public.installation_guides
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = installation_guides.resource_id
      AND r.lifecycle = 'archived'
      AND public.v2_user_owns_resource(r.id)
  )
);

-- 5) licenses
CREATE POLICY "licenses_owner_read_archived"
ON public.licenses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = licenses.resource_id
      AND r.lifecycle = 'archived'
      AND public.v2_user_owns_resource(r.id)
  )
);

-- 6) resource_permissions: owner read of PUBLIC disclosures for archived
CREATE POLICY "resource_permissions_owner_read_archived_public"
ON public.resource_permissions
FOR SELECT
TO authenticated
USING (
  is_public = true
  AND EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = resource_permissions.resource_id
      AND r.lifecycle = 'archived'
      AND public.v2_user_owns_resource(r.id)
  )
);


-- 7) get_my_downloadable_files ----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_downloadable_files(
  p_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
  resource_id      uuid,
  resource_file_id uuid,
  file_name        text,
  content_type     text,
  size_bytes       bigint,
  checksum         text,
  version          text,
  major_version    integer,
  updated_at       timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    r.id                AS resource_id,
    rf.id               AS resource_file_id,
    rf.file_name,
    rf.content_type,
    rf.size_bytes,
    rf.checksum,
    rv.version,
    rv.major_version,
    rv.updated_at
  FROM public.resource_files rf
  JOIN public.resource_versions rv ON rv.id = rf.resource_version_id
  JOIN public.resources r          ON r.id = rv.resource_id
  WHERE (p_resource_id IS NULL OR r.id = p_resource_id)
    AND r.lifecycle IN ('published','archived')
    AND EXISTS (
      SELECT 1 FROM public.entitlements e
      WHERE e.user_id = v_user
        AND e.revoked_at IS NULL
        AND (e.expires_at IS NULL OR e.expires_at > now())
        AND (
          e.scope = 'library'
          OR (
            e.scope = 'resource'
            AND e.resource_id = r.id
            AND (e.version_major IS NULL OR e.version_major = rv.major_version)
          )
        )
    )
    -- Only clean packages surface here. Latest-scan by created_at.
    AND EXISTS (
      SELECT 1 FROM (
        SELECT s.status
        FROM public.package_scans s
        WHERE s.resource_version_id = rv.id
        ORDER BY s.created_at DESC, s.scanned_at DESC NULLS LAST
        LIMIT 1
      ) latest
      WHERE latest.status = 'clean'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_downloadable_files(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_downloadable_files(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_downloadable_files(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_my_downloadable_files(uuid) IS
  'Returns only the caller''s authorized, downloadable file IDs and safe metadata. Never returns storage bucket/path or scan findings. Package downloads still flow through the resource-download Edge Function.';
