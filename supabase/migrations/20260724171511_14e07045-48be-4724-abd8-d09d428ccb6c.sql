
-- Phase 6D: Secure Package File Ingestion (forward-only)
-- Note: bucket file_size_limit/allowed_mime_types must be set via Supabase dashboard;
-- migration tool does not permit writes to storage.buckets. Server validation in the
-- edge function and in this RPC is authoritative.

CREATE OR REPLACE FUNCTION public.v2_internal_register_resource_file(
  p_actor_user_id uuid,
  p_version_id uuid,
  p_storage_path text,
  p_file_name text,
  p_content_type text,
  p_size_bytes bigint,
  p_checksum_sha256 text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_file_id uuid;
  v_now timestamptz := now();
  v_allowed_ct text[] := ARRAY[
    'application/zip','application/x-zip-compressed',
    'application/json','application/yaml','application/x-yaml',
    'text/yaml','text/x-yaml','text/markdown','text/plain',
    'application/octet-stream'
  ];
  v_parts text[];
  v_count int;
  v_only_checksum text;
  v_uuid_re text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  IF p_actor_user_id IS NULL OR NOT public.has_role(p_actor_user_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.resource_versions WHERE id = p_version_id) THEN
    RAISE EXCEPTION 'version_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_file_name IS NULL
     OR length(p_file_name) < 1
     OR length(p_file_name) > 180
     OR p_file_name IN ('.', '..')
     OR position('/'  in p_file_name) > 0
     OR position(E'\\' in p_file_name) > 0
     OR p_file_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'invalid_file_name' USING ERRCODE = '22023';
  END IF;

  IF p_storage_path IS NULL
     OR length(p_storage_path) > 512
     OR position(E'\\' in p_storage_path) > 0
     OR p_storage_path ~ '[[:cntrl:]]'
     OR position('..' in p_storage_path) > 0 THEN
    RAISE EXCEPTION 'invalid_storage_path' USING ERRCODE = '22023';
  END IF;

  v_parts := string_to_array(p_storage_path, '/');
  IF v_parts IS NULL
     OR array_length(v_parts, 1) <> 3
     OR v_parts[1] <> p_version_id::text
     OR v_parts[2] !~ v_uuid_re
     OR v_parts[3] <> p_file_name THEN
    RAISE EXCEPTION 'invalid_storage_path' USING ERRCODE = '22023';
  END IF;

  IF p_size_bytes IS NULL OR p_size_bytes < 1 OR p_size_bytes > 26214400 THEN
    RAISE EXCEPTION 'invalid_file_size' USING ERRCODE = '22023';
  END IF;

  IF p_checksum_sha256 IS NULL OR p_checksum_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_checksum' USING ERRCODE = '22023';
  END IF;

  IF p_content_type IS NULL OR NOT (p_content_type = ANY(v_allowed_ct)) THEN
    RAISE EXCEPTION 'invalid_content_type' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.resource_files(
    resource_version_id, storage_bucket, storage_path, file_name,
    content_type, size_bytes, checksum_sha256
  ) VALUES (
    p_version_id, 'resource-packages', p_storage_path, p_file_name,
    p_content_type, p_size_bytes, p_checksum_sha256
  ) RETURNING id INTO v_file_id;

  SELECT count(*) INTO v_count FROM public.resource_files WHERE resource_version_id = p_version_id;
  IF v_count = 1 THEN
    SELECT checksum_sha256 INTO v_only_checksum FROM public.resource_files WHERE resource_version_id = p_version_id;
  ELSE
    v_only_checksum := NULL;
  END IF;

  UPDATE public.resource_versions
  SET package_size_bytes = (
        SELECT COALESCE(sum(size_bytes),0) FROM public.resource_files WHERE resource_version_id = p_version_id
      ),
      package_checksum = v_only_checksum,
      updated_at = v_now
  WHERE id = p_version_id;

  INSERT INTO public.activity_events(
    actor_user_id, actor_type, action, entity_type, entity_id, metadata
  ) VALUES (
    p_actor_user_id, 'admin', 'resource.file_uploaded', 'resource_version', p_version_id,
    jsonb_build_object(
      'file_id', v_file_id,
      'file_name', p_file_name,
      'size_bytes', p_size_bytes,
      'checksum_present', true
    )
  );

  RETURN jsonb_build_object(
    'file_id', v_file_id,
    'file_name', p_file_name,
    'content_type', p_content_type,
    'size_bytes', p_size_bytes,
    'checksum_sha256', p_checksum_sha256,
    'created_at', v_now
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.v2_internal_register_resource_file(uuid,uuid,text,text,text,bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_internal_register_resource_file(uuid,uuid,text,text,text,bigint,text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_internal_register_resource_file(uuid,uuid,text,text,text,bigint,text) TO service_role;

REVOKE ALL ON public.resource_files FROM anon;
REVOKE ALL ON public.package_scans FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.resource_files FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.package_scans FROM authenticated;
GRANT SELECT ON public.resource_files TO authenticated;
GRANT SELECT ON public.package_scans  TO authenticated;
