
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
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_resource record;
  v_version record;
  v_file_id uuid;
  v_existing record;
  v_latest_scan record;
  v_newly_registered boolean := false;
  v_scan_created boolean := false;
  v_scan_status text;
BEGIN
  -- Actor must be an admin
  SELECT public.has_role(p_actor_user_id, 'admin'::app_role) INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Lock the resource row and validate
  SELECT id, type, current_version_id, lifecycle
    INTO v_resource
    FROM public.resources
    WHERE id = p_resource_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'resource_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_resource.type NOT IN ('skill','automation') THEN
    RAISE EXCEPTION 'invalid_resource_type' USING ERRCODE = '22023';
  END IF;
  IF v_resource.lifecycle = 'archived' THEN
    RAISE EXCEPTION 'resource_archived' USING ERRCODE = '22023';
  END IF;
  IF v_resource.current_version_id IS DISTINCT FROM p_resource_version_id THEN
    RAISE EXCEPTION 'version_not_current' USING ERRCODE = '22023';
  END IF;

  -- Lock the version row
  SELECT id, resource_id, published_at
    INTO v_version
    FROM public.resource_versions
    WHERE id = p_resource_version_id
    FOR UPDATE;
  IF NOT FOUND OR v_version.resource_id <> p_resource_id THEN
    RAISE EXCEPTION 'version_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent insert against the unique (storage_bucket, storage_path)
  INSERT INTO public.resource_files (
    resource_version_id, storage_bucket, storage_path,
    file_name, content_type, size_bytes, checksum_sha256
  )
  VALUES (
    p_resource_version_id, p_storage_bucket, p_storage_path,
    p_file_name, p_content_type, p_size_bytes, lower(p_checksum_sha256_client)
  )
  ON CONFLICT (storage_bucket, storage_path) DO NOTHING
  RETURNING id INTO v_file_id;

  IF v_file_id IS NOT NULL THEN
    v_newly_registered := true;
  ELSE
    -- Row already existed. Validate it matches the same declared metadata.
    SELECT id, resource_version_id, file_name, content_type, size_bytes, checksum_sha256
      INTO v_existing
      FROM public.resource_files
      WHERE storage_bucket = p_storage_bucket
        AND storage_path = p_storage_path
      FOR UPDATE;
    IF v_existing.resource_version_id <> p_resource_version_id
       OR v_existing.file_name <> p_file_name
       OR v_existing.content_type IS DISTINCT FROM p_content_type
       OR v_existing.size_bytes <> p_size_bytes
       OR lower(COALESCE(v_existing.checksum_sha256,'')) <> lower(p_checksum_sha256_client) THEN
      RAISE EXCEPTION 'path_conflict' USING ERRCODE = '23505';
    END IF;
    v_file_id := v_existing.id;
  END IF;

  -- Look at the latest scan on this version
  SELECT id, status::text AS status
    INTO v_latest_scan
    FROM public.package_scans
    WHERE resource_version_id = p_resource_version_id
    ORDER BY created_at DESC, scanned_at DESC NULLS LAST
    LIMIT 1;

  IF v_newly_registered THEN
    -- New file: ensure a pending scan exists (create one unless latest is already pending).
    IF v_latest_scan.id IS NULL OR v_latest_scan.status <> 'pending' THEN
      INSERT INTO public.package_scans (resource_version_id, status, scanner)
      VALUES (p_resource_version_id, 'pending', 'pending-external');
      v_scan_created := true;
      v_scan_status := 'pending';
    ELSE
      v_scan_status := v_latest_scan.status;
    END IF;

    INSERT INTO public.activity_events (
      actor_user_id, actor_type, entity_type, entity_id, action, metadata
    ) VALUES (
      p_actor_user_id, 'admin', 'resource_file', v_file_id,
      'package_upload_finalized',
      jsonb_build_object(
        'resource_id', p_resource_id,
        'resource_version_id', p_resource_version_id,
        'storage_bucket', p_storage_bucket,
        'storage_path', p_storage_path,
        'file_name', p_file_name,
        'size_bytes', p_size_bytes,
        'content_type', p_content_type,
        'checksum_sha256_client_declared', true,
        'scan_created', v_scan_created
      )
    );
  ELSE
    -- Duplicate finalize for an identical, already-registered file.
    -- Do NOT create another scan or audit event. Return latest scan state.
    v_scan_status := COALESCE(v_latest_scan.status, 'pending');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'resource_file_id', v_file_id,
    'newly_registered', v_newly_registered,
    'scan_created', v_scan_created,
    'scan_status', v_scan_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_finalize_resource_package(uuid,uuid,uuid,text,text,text,text,bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_finalize_resource_package(uuid,uuid,uuid,text,text,text,text,bigint,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_finalize_resource_package(uuid,uuid,uuid,text,text,text,text,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_resource_package(uuid,uuid,uuid,text,text,text,text,bigint,text) TO service_role;
