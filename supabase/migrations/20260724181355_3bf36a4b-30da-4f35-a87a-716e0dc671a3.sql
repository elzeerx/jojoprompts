
-- Phase 6E2: MetaDefender Cloud private-scanning foundation.
-- Forward-only. Provider-neutral. No data mutations, no provider calls.

-- 1) Extend package_scans (minimal, additive)
ALTER TABLE public.package_scans
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_code text;

-- At most one pending scan per version
CREATE UNIQUE INDEX IF NOT EXISTS package_scans_one_pending_per_version
  ON public.package_scans(resource_version_id)
  WHERE status = 'pending';

-- 2) package_scan_items table
CREATE TABLE IF NOT EXISTS public.package_scan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_scan_id uuid NOT NULL REFERENCES public.package_scans(id) ON DELETE CASCADE,
  resource_file_id uuid NOT NULL REFERENCES public.resource_files(id) ON DELETE RESTRICT,
  provider_data_id text,
  status public.v2_scan_status NOT NULL DEFAULT 'pending',
  result_code int,
  progress int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  total_engines int,
  detected_engines int,
  findings jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempt_count int NOT NULL DEFAULT 0,
  next_poll_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_scan_id, resource_file_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS package_scan_items_provider_data_id_unique
  ON public.package_scan_items(provider_data_id) WHERE provider_data_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS package_scan_items_pending_next_poll
  ON public.package_scan_items(next_poll_at)
  WHERE status = 'pending';

-- Grants: service_role only; no anon/authenticated.
REVOKE ALL ON public.package_scan_items FROM PUBLIC;
GRANT ALL ON public.package_scan_items TO service_role;

ALTER TABLE public.package_scan_items ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies for anon/authenticated: rows are unreachable to them.
-- service_role bypasses RLS.

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_package_scan_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_package_scan_items_updated_at ON public.package_scan_items;
CREATE TRIGGER trg_package_scan_items_updated_at
  BEFORE UPDATE ON public.package_scan_items
  FOR EACH ROW EXECUTE FUNCTION public.set_package_scan_items_updated_at();

-- 3) Internal RPCs (service_role only)

-- Create a scan run + items atomically. Errors: no_files, pending_exists.
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
BEGIN
  IF p_version_id IS NULL OR p_scanner IS NULL OR btrim(p_scanner) = '' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_file_count
    FROM public.resource_files WHERE resource_version_id = p_version_id;
  IF v_file_count = 0 THEN
    RAISE EXCEPTION 'no_files' USING ERRCODE = '22023';
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

REVOKE ALL ON FUNCTION public.v2_internal_create_package_scan(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_internal_create_package_scan(uuid, text, uuid) TO service_role;

-- Claim pending items to submit (SKIP LOCKED, idempotent).
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
         updated_at = now()
    FROM claimable c
   WHERE psi.id = c.id
  RETURNING psi.id, psi.resource_file_id, psi.attempt_count;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_claim_scan_items(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_internal_claim_scan_items(uuid, int) TO service_role;

-- Record provider submission id (idempotent: first writer wins).
CREATE OR REPLACE FUNCTION public.v2_internal_record_scan_submission(
  p_item_id uuid,
  p_data_id text,
  p_next_poll_at timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_item_id IS NULL OR p_data_id IS NULL OR btrim(p_data_id) = '' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;
  UPDATE public.package_scan_items
     SET provider_data_id = COALESCE(provider_data_id, p_data_id),
         submitted_at = COALESCE(submitted_at, now()),
         next_poll_at = p_next_poll_at,
         updated_at = now()
   WHERE id = p_item_id
     AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_record_scan_submission(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_internal_record_scan_submission(uuid, text, timestamptz) TO service_role;

-- Apply normalized per-item result and recompute aggregate scan.
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
  v_agg public.v2_scan_status;
  v_completed_all boolean;
  v_findings_agg jsonb;
BEGIN
  IF p_item_id IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = '22023';
  END IF;

  UPDATE public.package_scan_items
     SET status = CASE
                   WHEN status IN ('clean','malicious','suspicious','failed') THEN status
                   ELSE p_status
                 END,
         result_code = COALESCE(p_result_code, result_code),
         progress = GREATEST(COALESCE(progress, 0), COALESCE(p_progress, 0)),
         total_engines = COALESCE(p_total_engines, total_engines),
         detected_engines = COALESCE(p_detected_engines, detected_engines),
         findings = COALESCE(p_findings, findings),
         next_poll_at = CASE WHEN p_status = 'pending' THEN p_next_poll_at ELSE NULL END,
         completed_at = CASE
                          WHEN p_status IN ('clean','malicious','suspicious','failed')
                               AND completed_at IS NULL THEN now()
                          ELSE completed_at
                        END,
         updated_at = now()
   WHERE id = p_item_id
  RETURNING package_scan_id INTO v_scan_id;

  IF v_scan_id IS NULL THEN
    RETURN;
  END IF;

  IF p_last_error_code IS NOT NULL THEN
    UPDATE public.package_scans
       SET last_error_code = p_last_error_code, updated_at = now()
     WHERE id = v_scan_id;
  END IF;

  SELECT
    CASE
      WHEN bool_or(status = 'malicious') THEN 'malicious'::public.v2_scan_status
      WHEN bool_or(status = 'suspicious') THEN 'suspicious'::public.v2_scan_status
      WHEN bool_or(status = 'pending') THEN 'pending'::public.v2_scan_status
      WHEN bool_or(status = 'failed') THEN 'failed'::public.v2_scan_status
      ELSE 'clean'::public.v2_scan_status
    END,
    NOT bool_or(status = 'pending'),
    jsonb_build_object(
      'items', count(*),
      'clean', count(*) FILTER (WHERE status = 'clean'),
      'pending', count(*) FILTER (WHERE status = 'pending'),
      'suspicious', count(*) FILTER (WHERE status = 'suspicious'),
      'malicious', count(*) FILTER (WHERE status = 'malicious'),
      'failed', count(*) FILTER (WHERE status = 'failed'),
      'detected_engines', COALESCE(sum(detected_engines), 0),
      'total_engines', COALESCE(max(total_engines), 0),
      'progress_pct', COALESCE(round(avg(progress)::numeric, 0), 0)
    )
    INTO v_agg, v_completed_all, v_findings_agg
    FROM public.package_scan_items
   WHERE package_scan_id = v_scan_id;

  UPDATE public.package_scans ps
     SET status = CASE
                   -- Never downgrade an already-clean scan.
                   WHEN ps.status = 'clean' AND v_agg <> 'clean' THEN ps.status
                   ELSE v_agg
                 END,
         findings = v_findings_agg,
         scanned_at = CASE WHEN v_completed_all THEN COALESCE(ps.scanned_at, now()) ELSE ps.scanned_at END,
         completed_at = CASE WHEN v_completed_all THEN COALESCE(ps.completed_at, now()) ELSE ps.completed_at END,
         attempt_count = ps.attempt_count + 1,
         updated_at = now()
   WHERE ps.id = v_scan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.v2_internal_apply_scan_item_result(uuid, public.v2_scan_status, int, int, int, int, jsonb, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v2_internal_apply_scan_item_result(uuid, public.v2_scan_status, int, int, int, int, jsonb, timestamptz, text) TO service_role;
