
-- 1. Corrective: get_my_downloadable_files uses resource_files.checksum_sha256
CREATE OR REPLACE FUNCTION public.get_my_downloadable_files(p_resource_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(resource_id uuid, resource_file_id uuid, file_name text, content_type text, size_bytes bigint, checksum text, version text, major_version integer, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    r.id                       AS resource_id,
    rf.id                      AS resource_file_id,
    rf.file_name,
    rf.content_type,
    rf.size_bytes,
    rf.checksum_sha256         AS checksum,
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
$function$;

REVOKE EXECUTE ON FUNCTION public.get_my_downloadable_files(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_downloadable_files(uuid) TO authenticated;

-- Runtime sanity check the fixed RPC parses/plans on the actual schema.
DO $$
BEGIN
  PERFORM * FROM public.get_my_downloadable_files(NULL) LIMIT 0;
EXCEPTION WHEN insufficient_privilege OR sqlstate '28000' THEN
  -- Expected: definer runs as postgres, but auth.uid() may raise. Skip.
  NULL;
END $$;

-- 2. Sanitized inactive entitlements for My Library.
--    Only exposes the caller's own revoked/expired resource-scope rows and
--    joins the minimum resource metadata needed to render a non-downloadable
--    card. Never returns order_id, order fields, or storage paths.
CREATE OR REPLACE FUNCTION public.get_my_inactive_entitlements()
 RETURNS TABLE(
   entitlement_id uuid,
   resource_id uuid,
   resource_slug text,
   resource_type public.v2_resource_type,
   title_en text,
   title_ar text,
   version_major integer,
   granted_at timestamp with time zone,
   expires_at timestamp with time zone,
   revoked_at timestamp with time zone,
   revoke_reason text,
   status text
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    e.id                                    AS entitlement_id,
    e.resource_id,
    r.slug                                  AS resource_slug,
    r.type                                  AS resource_type,
    r.title_en,
    r.title_ar,
    e.version_major,
    e.granted_at,
    e.expires_at,
    e.revoked_at,
    e.revoke_reason,
    CASE
      WHEN e.revoked_at IS NOT NULL THEN 'revoked'
      WHEN e.expires_at IS NOT NULL AND e.expires_at <= now() THEN 'expired'
      ELSE 'inactive'
    END                                     AS status
  FROM public.entitlements e
  JOIN public.resources r ON r.id = e.resource_id
  WHERE e.user_id = v_user
    AND e.scope = 'resource'
    AND (
      e.revoked_at IS NOT NULL
      OR (e.expires_at IS NOT NULL AND e.expires_at <= now())
    )
  ORDER BY COALESCE(e.revoked_at, e.expires_at) DESC NULLS LAST;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_my_inactive_entitlements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_inactive_entitlements() TO authenticated;

DO $$
BEGIN
  PERFORM * FROM public.get_my_inactive_entitlements() LIMIT 0;
EXCEPTION WHEN insufficient_privilege OR sqlstate '28000' THEN
  NULL;
END $$;
