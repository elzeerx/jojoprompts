
-- A) Drop ONLY the broken 8-arg overload
DROP FUNCTION IF EXISTS public.admin_finalize_resource_package(uuid,uuid,uuid,text,text,bigint,text,text);

-- B) Replace the real 9-arg function with schema-correct logic
CREATE OR REPLACE FUNCTION public.admin_finalize_resource_package(
  p_actor_user_id uuid,
  p_resource_id uuid,
  p_resource_version_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_file_name text,
  p_content_type text,
  p_size_bytes bigint,
  p_checksum_sha256_client text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_admin boolean;
  v_res record;
  v_ver_ok boolean;
  v_checksum text := lower(p_checksum_sha256_client);
  v_file_id uuid;
  v_newly_registered boolean := false;
  v_existing record;
  v_latest_scan record;
  v_scan_created boolean := false;
  v_scan_status text;
  v_action text;
BEGIN
  -- 1) AuthZ
  SELECT public.has_role(p_actor_user_id, 'admin'::public.app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE = '42501';
  END IF;

  -- Lock resource row and validate lifecycle/type/current version
  SELECT id, type::text AS type, current_version_id, lifecycle::text AS lifecycle
    INTO v_res
    FROM public.resources
    WHERE id = p_resource_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resource_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_res.type NOT IN ('skill','automation') THEN
    RAISE EXCEPTION 'unsupported_resource_type' USING ERRCODE = '22023';
  END IF;

  IF v_res.lifecycle = 'archived' THEN
    RAISE EXCEPTION 'resource_archived' USING ERRCODE = '22023';
  END IF;

  IF v_res.current_version_id IS DISTINCT FROM p_resource_version_id THEN
    RAISE EXCEPTION 'version_not_current' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.resource_versions
    WHERE id = p_resource_version_id AND resource_id = p_resource_id
  ) INTO v_ver_ok;

  IF NOT v_ver_ok THEN
    RAISE EXCEPTION 'version_mismatch' USING ERRCODE = '22023';
  END IF;

  -- 2) Register file with ON CONFLICT no-op on (storage_bucket, storage_path)
  INSERT INTO public.resource_files (
    resource_version_id, storage_bucket, storage_path, file_name,
    content_type, size_bytes, checksum_sha256
  ) VALUES (
    p_resource_version_id, p_storage_bucket, p_storage_path, p_file_name,
    p_content_type, p_size_bytes, v_checksum
  )
  ON CONFLICT (storage_bucket, storage_path) DO NOTHING
  RETURNING id INTO v_file_id;

  IF v_file_id IS NOT NULL THEN
    v_newly_registered := true;
  ELSE
    -- 3) Conflict: lock existing row and require exact metadata match
    SELECT id, resource_version_id, file_name, content_type, size_bytes, checksum_sha256
      INTO v_existing
      FROM public.resource_files
      WHERE storage_bucket = p_storage_bucket AND storage_path = p_storage_path
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'path_conflict' USING ERRCODE = '23505';
    END IF;

    IF v_existing.resource_version_id IS DISTINCT FROM p_resource_version_id
       OR v_existing.file_name IS DISTINCT FROM p_file_name
       OR v_existing.content_type IS DISTINCT FROM p_content_type
       OR v_existing.size_bytes IS DISTINCT FROM p_size_bytes
       OR lower(v_existing.checksum_sha256) IS DISTINCT FROM v_checksum THEN
      RAISE EXCEPTION 'path_conflict' USING ERRCODE = '23505';
    END IF;

    v_file_id := v_existing.id;
  END IF;

  -- 4) Latest scan for the VERSION
  SELECT id, status::text AS status
    INTO v_latest_scan
    FROM public.package_scans
    WHERE resource_version_id = p_resource_version_id
    ORDER BY created_at DESC, scanned_at DESC NULLS LAST
    LIMIT 1;

  IF v_newly_registered THEN
    -- 5) New file path
    IF v_latest_scan.id IS NULL OR v_latest_scan.status <> 'pending' THEN
      INSERT INTO public.package_scans (resource_version_id, status, scanner)
      VALUES (p_resource_version_id, 'pending', 'pending-external')
      RETURNING status::text INTO v_scan_status;
      v_scan_created := true;
    ELSE
      v_scan_status := v_latest_scan.status;
    END IF;

    v_action := 'package_upload_finalized';
    INSERT INTO public.activity_events (
      actor_user_id, actor_type, entity_type, entity_id, action, metadata
    ) VALUES (
      p_actor_user_id, 'admin', 'resource_file', v_file_id, v_action,
      jsonb_build_object(
        'resource_id', p_resource_id,
        'resource_version_id', p_resource_version_id,
        'storage_bucket', p_storage_bucket,
        'storage_path', p_storage_path,
        'file_name', p_file_name,
        'content_type', p_content_type,
        'size_bytes', p_size_bytes,
        'checksum_sha256', v_checksum,
        'scan_created', v_scan_created
      )
    );
  ELSE
    -- 6) Existing identical file: only act if NO scan exists at all
    IF v_latest_scan.id IS NULL THEN
      INSERT INTO public.package_scans (resource_version_id, status, scanner)
      VALUES (p_resource_version_id, 'pending', 'pending-external')
      RETURNING status::text INTO v_scan_status;
      v_scan_created := true;

      v_action := 'package_scan_recovery_queued';
      INSERT INTO public.activity_events (
        actor_user_id, actor_type, entity_type, entity_id, action, metadata
      ) VALUES (
        p_actor_user_id, 'admin', 'resource_file', v_file_id, v_action,
        jsonb_build_object(
          'resource_id', p_resource_id,
          'resource_version_id', p_resource_version_id,
          'storage_bucket', p_storage_bucket,
          'storage_path', p_storage_path,
          'reason', 'no_prior_scan'
        )
      );
    ELSE
      v_scan_status := v_latest_scan.status;
    END IF;
  END IF;

  -- 7) Return contract
  RETURN jsonb_build_object(
    'ok', true,
    'resource_file_id', v_file_id,
    'newly_registered', v_newly_registered,
    'scan_created', v_scan_created,
    'scan_status', v_scan_status
  );
END;
$$;

-- C) Lock down execute privileges to service_role only
REVOKE ALL ON FUNCTION public.admin_finalize_resource_package(uuid,uuid,uuid,text,text,text,text,bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_finalize_resource_package(uuid,uuid,uuid,text,text,text,text,bigint,text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_finalize_resource_package(uuid,uuid,uuid,text,text,text,text,bigint,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_resource_package(uuid,uuid,uuid,text,text,text,text,bigint,text) TO service_role;
