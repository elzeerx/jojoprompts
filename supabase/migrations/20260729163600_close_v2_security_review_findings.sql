-- Close the two authorization gaps found during the pre-publication V2
-- security review:
--   1. The legacy jadmin role must not bypass V2 entitlements.
--   2. Non-admin readers must only see the explicitly published version row.

BEGIN;

CREATE OR REPLACE FUNCTION private._v2_entitled_resource_version(
  p_resource_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_latest_published uuid;
  v_collection_key text;
  v_version_id uuid;
BEGIN
  IF p_resource_id IS NULL OR p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT r.latest_published_version_id
    INTO v_latest_published
    FROM public.resources r
   WHERE r.id = p_resource_id
     AND r.lifecycle IN (
       'published'::public.v2_resource_lifecycle,
       'archived'::public.v2_resource_lifecycle
     );

  IF NOT FOUND OR v_latest_published IS NULL THEN
    RETURN NULL;
  END IF;

  -- Full V2 administrators may preview the published delivery version.
  -- The legacy partial-admin role intentionally remains subject to the same
  -- entitlement checks as every other customer identity.
  IF public.has_role(p_user_id, 'admin'::public.app_role) THEN
    RETURN v_latest_published;
  END IF;

  v_collection_key := public.v2_resource_collection_key(p_resource_id);

  IF EXISTS (
    SELECT 1
      FROM public.entitlements e
     WHERE e.user_id = p_user_id
       AND e.revoked_at IS NULL
       AND (e.expires_at IS NULL OR e.expires_at > now())
       AND (
         e.scope = 'library'::public.v2_entitlement_scope
         OR (
           e.scope = 'collection'::public.v2_entitlement_scope
           AND v_collection_key IS NOT NULL
           AND e.collection_key = v_collection_key
         )
       )
  ) THEN
    RETURN v_latest_published;
  END IF;

  SELECT rv.id
    INTO v_version_id
    FROM public.resource_versions rv
   WHERE rv.resource_id = p_resource_id
     AND rv.published_at IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.entitlements e
        WHERE e.user_id = p_user_id
          AND e.revoked_at IS NULL
          AND (e.expires_at IS NULL OR e.expires_at > now())
          AND e.scope = 'resource'::public.v2_entitlement_scope
          AND e.resource_id = p_resource_id
          AND (
            e.version_major IS NULL
            OR e.version_major = rv.major_version
          )
     )
   ORDER BY rv.major_version DESC, rv.published_at DESC,
            rv.created_at DESC, rv.id DESC
   LIMIT 1;

  RETURN v_version_id;
END
$$;

REVOKE ALL
  ON FUNCTION private._v2_entitled_resource_version(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

DROP POLICY IF EXISTS
  "resource_versions_public_read_when_parent_published"
  ON public.resource_versions;

CREATE POLICY "resource_versions_public_read_when_parent_published"
ON public.resource_versions
FOR SELECT
TO anon, authenticated
USING (
  published_at IS NOT NULL
  AND EXISTS (
    SELECT 1
      FROM public.resources r
     WHERE r.id = resource_versions.resource_id
       AND r.lifecycle = 'published'::public.v2_resource_lifecycle
       AND r.latest_published_version_id = resource_versions.id
  )
);

-- Archived owners retain access to the last published metadata row, but never
-- to an unpublished admin working version.
DROP POLICY IF EXISTS
  "resource_versions_owner_read_archived"
  ON public.resource_versions;

CREATE POLICY "resource_versions_owner_read_archived"
ON public.resource_versions
FOR SELECT
TO authenticated
USING (
  published_at IS NOT NULL
  AND EXISTS (
    SELECT 1
      FROM public.resources r
     WHERE r.id = resource_versions.resource_id
       AND r.lifecycle = 'archived'::public.v2_resource_lifecycle
       AND r.latest_published_version_id = resource_versions.id
       AND public.v2_user_owns_resource(r.id)
  )
);

COMMENT ON FUNCTION private._v2_entitled_resource_version(uuid, uuid) IS
  'Selects an entitled published delivery version. Only full admin may bypass customer entitlement checks.';

DO $$
DECLARE
  v_selector_definition text;
  v_public_policy_definition text;
  v_owner_policy_definition text;
BEGIN
  SELECT pg_get_functiondef(
           'private._v2_entitled_resource_version(uuid,uuid)'::regprocedure
         )
    INTO v_selector_definition;

  IF v_selector_definition ILIKE '%jadmin%' THEN
    RAISE EXCEPTION 'legacy_jadmin_v2_entitlement_bypass_present';
  END IF;

  SELECT pg_get_expr(p.polqual, p.polrelid)
    INTO v_public_policy_definition
    FROM pg_policy p
   WHERE p.polrelid = 'public.resource_versions'::regclass
     AND p.polname = 'resource_versions_public_read_when_parent_published';

  IF v_public_policy_definition IS NULL
     OR v_public_policy_definition NOT ILIKE '%latest_published_version_id%'
     OR v_public_policy_definition NOT ILIKE '%published_at%' THEN
    RAISE EXCEPTION 'public_resource_version_policy_not_pinned';
  END IF;

  SELECT pg_get_expr(p.polqual, p.polrelid)
    INTO v_owner_policy_definition
    FROM pg_policy p
   WHERE p.polrelid = 'public.resource_versions'::regclass
     AND p.polname = 'resource_versions_owner_read_archived';

  IF v_owner_policy_definition IS NULL
     OR v_owner_policy_definition NOT ILIKE '%latest_published_version_id%'
     OR v_owner_policy_definition NOT ILIKE '%published_at%' THEN
    RAISE EXCEPTION 'archived_owner_resource_version_policy_not_pinned';
  END IF;
END
$$;

COMMIT;
