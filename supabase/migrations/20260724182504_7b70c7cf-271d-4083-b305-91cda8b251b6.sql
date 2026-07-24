
-- Phase 6E2 corrective hardening. Forward-only. No data mutations.
-- Provider-neutral. All privileged helpers service_role only.

-- =========================================================================
-- 1) Submit-claim: set a lease so concurrent workers can't double-upload
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_internal_claim_scan_items(
  p_scan_id uuid,
  p_max int DEFAULT 5
) RETURNS TABLE (item_id uuid, resource_file_id uuid, attempt_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT psi.id
      FROM public.package_scan_items psi
     WHERE psi.package_scan_id = p_scan_id
       AND psi.status = 'pending'
       AND psi.provider_data_id IS NULL
       AND (psi.next_poll_at IS NULL OR psi.next_poll_at <= now())
     ORDER BY psi.created_at
     FOR UPDATE SKIP LOCKED
     LIMIT GREATEST(1, LEAST(COALESCE(p_max, 5), 20))
  )
  UPDATE public.package_scan_items psi
     SET attempt_count = psi.attempt_count + 1,
         next_poll_at  = now() + interval '2 minutes',
         updated_at    = now()
    FROM claimable c
   WHERE psi.id = c.id
  RETURNING psi.id, psi.resource_file_id, psi.attempt_count;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_claim_scan_items(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_internal_claim_scan_items(uuid, int) TO service_role;

-- =========================================================================
-- 2) Poll-claim: lease submitted pending items whose next_poll_at is due
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_internal_claim_scan_poll_items(
  p_scan_id uuid,
  p_max int DEFAULT 5
) RETURNS TABLE (item_id uuid, provider_data_id text, attempt_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT psi.id
      FROM public.package_scan_items psi
     WHERE psi.package_scan_id = p_scan_id
       AND psi.status = 'pending'
       AND psi.provider_data_id IS NOT NULL
       AND (psi.next_poll_at IS NULL OR psi.next_poll_at <= now())
     ORDER BY psi.next_poll_at NULLS FIRST, psi.created_at
     FOR UPDATE SKIP LOCKED
     LIMIT GREATEST(1, LEAST(COALESCE(p_max, 5), 20))
  )
  UPDATE public.package_scan_items psi
     SET attempt_count = psi.attempt_count + 1,
         next_poll_at  = now() + interval '2 minutes',
         updated_at    = now()
    FROM claimable c
   WHERE psi.id = c.id
  RETURNING psi.id, psi.provider_data_id, psi.attempt_count;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_claim_scan_poll_items(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_internal_claim_scan_poll_items(uuid, int) TO service_role;

-- =========================================================================
-- 3) Create-scan with atomic already_clean guard
-- =========================================================================
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
  v_file_count int;
  v_prev_scan_id uuid;
  v_all_items_clean boolean;
  v_covers_exact boolean;
BEGIN
  IF p_version_id IS NULL OR p_scanner IS NULL OR btrim(p_scanner) = '' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_file_count
    FROM public.resource_files WHERE resource_version_id = p_version_id;
  IF v_file_count = 0 THEN
    RAISE EXCEPTION 'no_files' USING ERRCODE = '22023';
  END IF;

  -- already_clean guard: latest clean scan whose items cover EXACTLY the
  -- current resource_files, and every one of those items is clean.
  SELECT ps.id INTO v_prev_scan_id
    FROM public.package_scans ps
   WHERE ps.resource_version_id = p_version_id
     AND ps.status = 'clean'
   ORDER BY ps.completed_at DESC NULLS LAST, ps.updated_at DESC
   LIMIT 1;

  IF v_prev_scan_id IS NOT NULL THEN
    SELECT bool_and(psi.status = 'clean') INTO v_all_items_clean
      FROM public.package_scan_items psi
     WHERE psi.package_scan_id = v_prev_scan_id;

    SELECT
      (SELECT count(*) FROM public.package_scan_items psi
         WHERE psi.package_scan_id = v_prev_scan_id
           AND psi.resource_file_id IN (
             SELECT id FROM public.resource_files
              WHERE resource_version_id = p_version_id))
      = v_file_count
      AND
      (SELECT count(*) FROM public.package_scan_items psi
         WHERE psi.package_scan_id = v_prev_scan_id) = v_file_count
      INTO v_covers_exact;

    IF COALESCE(v_all_items_clean, false) AND COALESCE(v_covers_exact, false) THEN
      RAISE EXCEPTION 'already_clean' USING ERRCODE = '23505';
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.package_scans (
      resource_version_id, scanner, status, findings,
      requested_by, requested_at, attempt_count
    ) VALUES (
      p_version_id, p_scanner, 'pending', '{}'::jsonb,
      p_requested_by, now(), 0
    ) RETURNING id INTO v_scan_id;
  EXCEPTION WHEN unique_violation THEN
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

-- =========================================================================
-- 4) Correct monotonic per-item result + correct aggregate precedence
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_internal_apply_scan_item_result(
  p_item_id uuid,
  p_status public.v2_scan_status,
  p_result_code int,
  p_progress int,
  p_total_engines int,
  p_detected_engines int,
  p_findings jsonb,
  p_next_poll_at timestamptz,
  p_last_error_code text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scan_id uuid;
  v_current_status public.v2_scan_status;
  v_current_completed timestamptz;
  v_incoming_rank int;
  v_current_rank int;
  v_effective_status public.v2_scan_status;
  v_agg public.v2_scan_status;
  v_completed_all boolean;
  v_findings_agg jsonb;
BEGIN
  IF p_item_id IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  -- Lock the row and read current state.
  SELECT status, completed_at, package_scan_id
    INTO v_current_status, v_current_completed, v_scan_id
    FROM public.package_scan_items
   WHERE id = p_item_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Monotonic precedence ranks (higher = stronger signal).
  v_current_rank := CASE v_current_status
    WHEN 'malicious'  THEN 4
    WHEN 'suspicious' THEN 3
    WHEN 'clean'      THEN 2
    WHEN 'failed'     THEN 1
    ELSE 0 END;
  v_incoming_rank := CASE p_status
    WHEN 'malicious'  THEN 4
    WHEN 'suspicious' THEN 3
    WHEN 'clean'      THEN 2
    WHEN 'failed'     THEN 1
    ELSE 0 END;

  IF v_incoming_rank > v_current_rank THEN
    v_effective_status := p_status;
  ELSE
    -- Equal or weaker: preserve current (duplicate/late/downgrade attempt).
    v_effective_status := v_current_status;
  END IF;

  UPDATE public.package_scan_items
     SET status           = v_effective_status,
         result_code      = CASE WHEN v_effective_status = p_status
                                 THEN COALESCE(p_result_code, result_code)
                                 ELSE result_code END,
         progress         = GREATEST(COALESCE(progress, 0), COALESCE(p_progress, 0)),
         total_engines    = COALESCE(p_total_engines, total_engines),
         detected_engines = COALESCE(p_detected_engines, detected_engines),
         findings         = CASE WHEN v_effective_status = p_status AND p_findings IS NOT NULL
                                 THEN p_findings ELSE findings END,
         -- next_poll_at only meaningful while pending; once terminal, clear.
         next_poll_at     = CASE WHEN v_effective_status = 'pending' THEN p_next_poll_at ELSE NULL END,
         completed_at     = CASE
                              WHEN v_effective_status IN ('clean','malicious','suspicious','failed')
                                   AND completed_at IS NULL THEN now()
                              ELSE completed_at
                            END,
         updated_at       = now()
   WHERE id = p_item_id;

  IF p_last_error_code IS NOT NULL THEN
    UPDATE public.package_scans
       SET last_error_code = p_last_error_code, updated_at = now()
     WHERE id = v_scan_id;
  END IF;

  -- Aggregate: malicious > suspicious > failed > (clean iff all clean) > pending.
  SELECT
    CASE
      WHEN bool_or(status = 'malicious')  THEN 'malicious'::public.v2_scan_status
      WHEN bool_or(status = 'suspicious') THEN 'suspicious'::public.v2_scan_status
      WHEN bool_or(status = 'failed')     THEN 'failed'::public.v2_scan_status
      WHEN bool_and(status = 'clean')     THEN 'clean'::public.v2_scan_status
      ELSE 'pending'::public.v2_scan_status
    END,
    NOT bool_or(status = 'pending'),
    jsonb_build_object(
      'items',            count(*),
      'clean',            count(*) FILTER (WHERE status = 'clean'),
      'pending',          count(*) FILTER (WHERE status = 'pending'),
      'suspicious',       count(*) FILTER (WHERE status = 'suspicious'),
      'malicious',        count(*) FILTER (WHERE status = 'malicious'),
      'failed',           count(*) FILTER (WHERE status = 'failed'),
      'detected_engines', COALESCE(sum(detected_engines), 0),
      'total_engines',    COALESCE(max(total_engines),    0),
      'progress_pct',     COALESCE(round(avg(progress)::numeric, 0), 0)
    )
    INTO v_agg, v_completed_all, v_findings_agg
    FROM public.package_scan_items
   WHERE package_scan_id = v_scan_id;

  -- Do NOT increment attempt_count here (attempts belong to claims).
  -- Do NOT re-stamp completed/scanned once set.
  UPDATE public.package_scans ps
     SET status       = v_agg,
         findings     = v_findings_agg,
         scanned_at   = CASE WHEN v_completed_all THEN COALESCE(ps.scanned_at,   now()) ELSE ps.scanned_at   END,
         completed_at = CASE WHEN v_completed_all THEN COALESCE(ps.completed_at, now()) ELSE ps.completed_at END,
         updated_at   = now()
   WHERE ps.id = v_scan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_apply_scan_item_result(uuid, public.v2_scan_status, int, int, int, int, jsonb, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_internal_apply_scan_item_result(uuid, public.v2_scan_status, int, int, int, int, jsonb, timestamptz, text) TO service_role;

-- Re-assert on the still-unchanged submission RPC too, defensively.
REVOKE ALL ON FUNCTION public.v2_internal_record_scan_submission(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.v2_internal_record_scan_submission(uuid, text, timestamptz) TO service_role;

-- =========================================================================
-- 5) Safe admin detail read RPC — no provider_data_id, no bucket/path/checksum
-- =========================================================================
CREATE OR REPLACE FUNCTION public.v2_admin_get_package_scan_details(
  p_scan_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_scan record;
  v_items jsonb;
  v_counts jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_scan_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT
    ps.id, ps.resource_version_id, ps.scanner, ps.status, ps.findings,
    ps.scanned_at, ps.created_at, ps.updated_at,
    ps.requested_at, ps.completed_at, ps.attempt_count, ps.last_error_code
  INTO v_scan
  FROM public.package_scans ps
  WHERE ps.id = p_scan_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',               psi.id,
      'status',           psi.status,
      'result_code',      psi.result_code,
      'progress',         psi.progress,
      'total_engines',    psi.total_engines,
      'detected_engines', psi.detected_engines,
      'findings',         psi.findings,
      'attempt_count',    psi.attempt_count,
      'submitted_at',     psi.submitted_at,
      'completed_at',     psi.completed_at,
      'created_at',       psi.created_at,
      'file', jsonb_build_object(
        'file_name',    rf.file_name,
        'content_type', rf.content_type,
        'size_bytes',   rf.size_bytes
      )
    )
    ORDER BY psi.created_at
  ), '[]'::jsonb)
  INTO v_items
  FROM public.package_scan_items psi
  LEFT JOIN public.resource_files rf ON rf.id = psi.resource_file_id
  WHERE psi.package_scan_id = p_scan_id;

  SELECT jsonb_build_object(
    'items',            count(*),
    'clean',            count(*) FILTER (WHERE status = 'clean'),
    'pending',          count(*) FILTER (WHERE status = 'pending'),
    'suspicious',       count(*) FILTER (WHERE status = 'suspicious'),
    'malicious',        count(*) FILTER (WHERE status = 'malicious'),
    'failed',           count(*) FILTER (WHERE status = 'failed'),
    'progress_pct',     COALESCE(round(avg(progress)::numeric, 0), 0),
    'total_engines',    COALESCE(max(total_engines),    0),
    'detected_engines', COALESCE(sum(detected_engines), 0)
  )
  INTO v_counts
  FROM public.package_scan_items
  WHERE package_scan_id = p_scan_id;

  RETURN jsonb_build_object(
    'scan', jsonb_build_object(
      'id',                  v_scan.id,
      'resource_version_id', v_scan.resource_version_id,
      'scanner',             v_scan.scanner,
      'status',              v_scan.status,
      'findings',            v_scan.findings,
      'scanned_at',          v_scan.scanned_at,
      'created_at',          v_scan.created_at,
      'updated_at',          v_scan.updated_at,
      'requested_at',        v_scan.requested_at,
      'completed_at',        v_scan.completed_at,
      'attempt_count',       v_scan.attempt_count,
      'last_error_code',     v_scan.last_error_code
    ),
    'counts', v_counts,
    'items',  v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.v2_admin_get_package_scan_details(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.v2_admin_get_package_scan_details(uuid) TO authenticated, service_role;
