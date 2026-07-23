
-- Recreate function with hardened search_path and idempotent recovery behavior
CREATE OR REPLACE FUNCTION public.admin_finalize_resource_package(
  p_actor_user_id uuid,
  p_resource_id uuid,
  p_version_id uuid,
  p_storage_path text,
  p_file_name text,
  p_file_size bigint,
  p_mime_type text,
  p_sha256 text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_admin boolean;
  v_resource_exists boolean;
  v_version_exists boolean;
  v_existing_file_id uuid;
  v_existing_sha text;
  v_file_id uuid;
  v_scan_id uuid;
  v_scan_status text;
  v_inserted_file boolean := false;
  v_inserted_scan boolean := false;
BEGIN
  -- Verify actor is admin (defense-in-depth; RPC is service_role-only)
  SELECT public.has_role(p_actor_user_id, 'admin'::public.app_role) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  -- Lock resource row for concurrency safety
  SELECT EXISTS(SELECT 1 FROM public.resources WHERE id = p_resource_id FOR UPDATE)
    INTO v_resource_exists;
  IF NOT v_resource_exists THEN
    RAISE EXCEPTION 'Resource not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.resource_versions
    WHERE id = p_version_id AND resource_id = p_resource_id
  ) INTO v_version_exists;
  IF NOT v_version_exists THEN
    RAISE EXCEPTION 'Version not found' USING ERRCODE = 'P0002';
  END IF;

  -- Look up any pre-existing file at this storage path
  SELECT id, sha256
    INTO v_existing_file_id, v_existing_sha
    FROM public.resource_files
    WHERE storage_path = p_storage_path
    LIMIT 1;

  IF v_existing_file_id IS NOT NULL THEN
    -- Duplicate: ensure sha matches, then handle scan recovery
    IF v_existing_sha IS DISTINCT FROM p_sha256 THEN
      RAISE EXCEPTION 'File hash mismatch for existing storage path' USING ERRCODE = '23514';
    END IF;

    v_file_id := v_existing_file_id;

    -- Return latest scan if one exists; otherwise insert a recovery pending scan
    SELECT id, status
      INTO v_scan_id, v_scan_status
      FROM public.package_scans
      WHERE resource_file_id = v_file_id
      ORDER BY created_at DESC
      LIMIT 1;

    IF v_scan_id IS NULL THEN
      INSERT INTO public.package_scans (resource_file_id, status)
      VALUES (v_file_id, 'pending')
      RETURNING id, status INTO v_scan_id, v_scan_status;
      v_inserted_scan := true;

      INSERT INTO public.activity_events (actor_user_id, event_type, resource_id, metadata)
      VALUES (
        p_actor_user_id,
        'package_scan_recovery_queued',
        p_resource_id,
        jsonb_build_object(
          'resource_file_id', v_file_id,
          'version_id', p_version_id,
          'storage_path', p_storage_path,
          'sha256', p_sha256
        )
      );
    END IF;
  ELSE
    -- New file: insert file + pending scan + audit atomically
    INSERT INTO public.resource_files (
      resource_id, version_id, storage_path, file_name, file_size, mime_type, sha256
    ) VALUES (
      p_resource_id, p_version_id, p_storage_path, p_file_name, p_file_size, p_mime_type, p_sha256
    )
    RETURNING id INTO v_file_id;
    v_inserted_file := true;

    INSERT INTO public.package_scans (resource_file_id, status)
    VALUES (v_file_id, 'pending')
    RETURNING id, status INTO v_scan_id, v_scan_status;
    v_inserted_scan := true;

    INSERT INTO public.activity_events (actor_user_id, event_type, resource_id, metadata)
    VALUES (
      p_actor_user_id,
      'package_uploaded',
      p_resource_id,
      jsonb_build_object(
        'resource_file_id', v_file_id,
        'version_id', p_version_id,
        'storage_path', p_storage_path,
        'file_size', p_file_size,
        'mime_type', p_mime_type,
        'sha256', p_sha256
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'resource_file_id', v_file_id,
    'scan_id', v_scan_id,
    'scan_status', v_scan_status,
    'inserted_file', v_inserted_file,
    'inserted_scan', v_inserted_scan
  );
END;
$$;

-- Lock down execution: service_role only
REVOKE ALL ON FUNCTION public.admin_finalize_resource_package(uuid, uuid, uuid, text, text, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_finalize_resource_package(uuid, uuid, uuid, text, text, bigint, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_finalize_resource_package(uuid, uuid, uuid, text, text, bigint, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_resource_package(uuid, uuid, uuid, text, text, bigint, text, text) TO service_role;
