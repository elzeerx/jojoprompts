
-- ============================================================
-- Phase B corrective hardening (additive)
-- ============================================================

-- 1) Server-only download authorization RPC ---------------------------------
-- Drop the previous version that was executable by authenticated users and
-- returned private storage paths.
DROP FUNCTION IF EXISTS public.authorize_resource_download(uuid);

CREATE OR REPLACE FUNCTION public.authorize_resource_download(
  p_file_id uuid,
  p_user_id uuid
)
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
  v_res   uuid;
  v_major integer;
  v_ver   uuid;
  v_scan  public.v2_scan_status;
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

  IF NOT EXISTS (
    SELECT 1 FROM public.entitlements e
    WHERE e.user_id = p_user_id
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

  -- Latest scan attempt: created_at is monotonic; scanned_at is only a tiebreaker.
  -- A newer pending scan (scanned_at NULL) MUST override an older clean scan.
  SELECT s.status INTO v_scan
  FROM public.package_scans s
  WHERE s.resource_version_id = v_ver
  ORDER BY s.created_at DESC, s.scanned_at DESC NULLS LAST
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

-- Service-role-only. Regular clients (anon/authenticated) must not be able
-- to invoke this and never see storage paths.
REVOKE ALL ON FUNCTION public.authorize_resource_download(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authorize_resource_download(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.authorize_resource_download(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_resource_download(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.authorize_resource_download(uuid, uuid) IS
  'Server-only download authorization. Callable exclusively by the service role from the resource-download Edge Function after the bearer JWT has been verified. Returns private bucket/path only; the Edge Function never forwards them to the client.';


-- 2) Public trust badge: fix latest-scan ordering ---------------------------
CREATE OR REPLACE FUNCTION public.get_public_resource_trust_badges(
  resource_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  resource_id  uuid,
  version_id   uuid,
  scan_status  text,
  scanned_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    r.id                     AS resource_id,
    rv.id                    AS version_id,
    ps.status::text          AS scan_status,
    ps.scanned_at            AS scanned_at
  FROM public.resources r
  JOIN public.resource_versions rv
    ON rv.id = r.current_version_id
   AND rv.resource_id = r.id
  LEFT JOIN LATERAL (
    SELECT s.status, s.scanned_at
    FROM public.package_scans s
    WHERE s.resource_version_id = rv.id
    ORDER BY s.created_at DESC, s.scanned_at DESC NULLS LAST
    LIMIT 1
  ) ps ON TRUE
  WHERE r.lifecycle = 'published'
    AND (resource_ids IS NULL OR r.id = ANY(resource_ids));
$$;

REVOKE ALL ON FUNCTION public.get_public_resource_trust_badges(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_resource_trust_badges(uuid[]) TO anon, authenticated;


-- 3) Free acquisition: retire expired-unrevoked rows first ------------------
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

  -- Atomically retire expired-but-unrevoked resource entitlements for this
  -- user/resource so partial unique indexes do not block the new grant.
  -- Historical row is preserved (revoked_at + revoke_reason).
  UPDATE public.entitlements
  SET revoked_at = now(),
      revoke_reason = 'expired_replaced_by_free_acquisition'
  WHERE user_id = v_user
    AND resource_id = p_resource_id
    AND scope = 'resource'
    AND revoked_at IS NULL
    AND expires_at IS NOT NULL
    AND expires_at <= now();

  -- Idempotent: return existing still-active entitlement if present.
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

  INSERT INTO public.activity_events
    (actor_user_id, actor_type, entity_type, entity_id, action, metadata)
  VALUES
    (v_user, 'user', 'entitlement', v_ent_id,
     CASE WHEN v_existed THEN 'free_acquisition_noop' ELSE 'free_acquisition_granted' END,
     jsonb_build_object('resource_id', p_resource_id, 'version_major', v_major));

  RETURN QUERY SELECT v_ent_id, p_resource_id, v_major, v_existed;
END;
$$;

COMMENT ON FUNCTION public.grant_free_acquisition(uuid) IS
  'Server-authoritative free acquisition. Requires auth.uid(). Retires expired-unrevoked resource entitlements for the same user/resource before granting so partial unique indexes do not block permanent replacement. Same pattern is REQUIRED for future purchase and lifetime settlement services: retire expired unrevoked rows before granting replacements.';


-- 4) Explicit privilege hardening for auth-only RPCs ------------------------
REVOKE ALL ON FUNCTION public.grant_free_acquisition(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_free_acquisition(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.grant_free_acquisition(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_library_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_library_state() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_library_state() TO authenticated;
