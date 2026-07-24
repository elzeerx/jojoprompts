
-- Phase: send-email hardening — new contact submission rate limit primitives
-- Scope: no data changes; only new schema (table + service-only RPC) + reuse existing check_rate_limit.

-- 1. Contact submission rate limit tracking (hashed identifiers only)
CREATE TABLE IF NOT EXISTS public.contact_submission_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('ip','email')),
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_rl_hash_scope_window
  ON public.contact_submission_rate_limits(identifier_hash, scope, window_start);
CREATE INDEX IF NOT EXISTS idx_contact_rl_last_request
  ON public.contact_submission_rate_limits(last_request_at);

-- Grants: table is service-role only. Revoke everything from anon/authenticated.
REVOKE ALL ON public.contact_submission_rate_limits FROM PUBLIC;
REVOKE ALL ON public.contact_submission_rate_limits FROM anon;
REVOKE ALL ON public.contact_submission_rate_limits FROM authenticated;
GRANT ALL ON public.contact_submission_rate_limits TO service_role;

ALTER TABLE public.contact_submission_rate_limits ENABLE ROW LEVEL SECURITY;

-- Explicit deny for anon/authenticated (defence in depth alongside revokes).
DROP POLICY IF EXISTS "contact_rl_service_only" ON public.contact_submission_rate_limits;
CREATE POLICY "contact_rl_service_only"
  ON public.contact_submission_rate_limits
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 2. Service-only claim RPC: atomic upsert-and-check with fixed window.
--    Callable only by service_role; SECURITY DEFINER with locked search_path.
CREATE OR REPLACE FUNCTION public.check_contact_submission_rate_limit(
  p_identifier_hash TEXT,
  p_scope           TEXT,
  p_max_requests    INTEGER,
  p_window_seconds  INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now         TIMESTAMPTZ := now();
  v_window_end  TIMESTAMPTZ;
  v_row         public.contact_submission_rate_limits;
  v_allowed     BOOLEAN := false;
  v_count       INTEGER  := 0;
  v_retry_after INTEGER  := 0;
BEGIN
  IF p_identifier_hash IS NULL OR length(p_identifier_hash) NOT BETWEEN 32 AND 128 THEN
    RAISE EXCEPTION 'invalid_identifier_hash';
  END IF;
  IF p_scope NOT IN ('ip','email') THEN
    RAISE EXCEPTION 'invalid_scope';
  END IF;
  IF p_max_requests IS NULL OR p_max_requests < 1 OR p_max_requests > 1000 THEN
    RAISE EXCEPTION 'invalid_max_requests';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 10 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid_window_seconds';
  END IF;

  -- Try to claim within an existing live window row (single writer per hash+scope).
  SELECT * INTO v_row
  FROM public.contact_submission_rate_limits
  WHERE identifier_hash = p_identifier_hash
    AND scope = p_scope
    AND window_start > v_now - make_interval(secs => p_window_seconds)
  ORDER BY window_start DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Fresh window. Concurrency: unique index (hash,scope,window_start) prevents dupes;
    -- ON CONFLICT collapses colliding first-writers safely.
    INSERT INTO public.contact_submission_rate_limits
      (identifier_hash, scope, request_count, window_start, last_request_at)
    VALUES (p_identifier_hash, p_scope, 1, v_now, v_now)
    ON CONFLICT (identifier_hash, scope, window_start) DO UPDATE
      SET request_count   = public.contact_submission_rate_limits.request_count + 1,
          last_request_at = v_now
      RETURNING * INTO v_row;
    v_allowed := (v_row.request_count <= p_max_requests);
    v_count   := v_row.request_count;
  ELSE
    IF v_row.request_count < p_max_requests THEN
      UPDATE public.contact_submission_rate_limits
        SET request_count = request_count + 1,
            last_request_at = v_now
        WHERE id = v_row.id
        RETURNING * INTO v_row;
      v_allowed := true;
      v_count   := v_row.request_count;
    ELSE
      v_allowed := false;
      v_count   := v_row.request_count;
    END IF;
  END IF;

  v_window_end  := v_row.window_start + make_interval(secs => p_window_seconds);
  v_retry_after := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_window_end - v_now)))::INTEGER);

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'count',   v_count,
    'limit',   p_max_requests,
    'retry_after_seconds', v_retry_after
  );
END;
$$;

-- Only service_role may execute the claim RPC (edge functions run as service_role).
REVOKE ALL ON FUNCTION public.check_contact_submission_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_contact_submission_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.check_contact_submission_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_contact_submission_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- 3. Assertions (rolled back inside the migration transaction).
DO $$
DECLARE
  r JSONB;
  probe_hash TEXT := repeat('a', 64);
BEGIN
  -- First two calls within a 1-request window: first allowed, second blocked.
  r := public.check_contact_submission_rate_limit(probe_hash, 'email', 1, 3600);
  IF NOT (r->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'assertion failed: first call should be allowed, got %', r;
  END IF;

  r := public.check_contact_submission_rate_limit(probe_hash, 'email', 1, 3600);
  IF (r->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'assertion failed: second call should be blocked, got %', r;
  END IF;

  IF (r->>'retry_after_seconds')::INTEGER <= 0 THEN
    RAISE EXCEPTION 'assertion failed: retry_after_seconds must be positive, got %', r;
  END IF;

  -- Bounds enforcement.
  BEGIN
    PERFORM public.check_contact_submission_rate_limit('short', 'email', 1, 3600);
    RAISE EXCEPTION 'assertion failed: short hash must raise';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM public.check_contact_submission_rate_limit(probe_hash, 'other', 1, 3600);
    RAISE EXCEPTION 'assertion failed: bad scope must raise';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Roll back all probe rows so migration leaves no data.
  DELETE FROM public.contact_submission_rate_limits WHERE identifier_hash = probe_hash;
END $$;

-- Grants sanity: assert non-service-role identities have no execute/insert.
DO $$
BEGIN
  IF has_function_privilege('anon',
       'public.check_contact_submission_rate_limit(text,text,integer,integer)', 'EXECUTE')
  THEN RAISE EXCEPTION 'anon must not execute check_contact_submission_rate_limit'; END IF;
  IF has_function_privilege('authenticated',
       'public.check_contact_submission_rate_limit(text,text,integer,integer)', 'EXECUTE')
  THEN RAISE EXCEPTION 'authenticated must not execute check_contact_submission_rate_limit'; END IF;
  IF has_table_privilege('anon', 'public.contact_submission_rate_limits', 'SELECT')
  THEN RAISE EXCEPTION 'anon must not select from contact_submission_rate_limits'; END IF;
  IF has_table_privilege('authenticated', 'public.contact_submission_rate_limits', 'INSERT')
  THEN RAISE EXCEPTION 'authenticated must not insert into contact_submission_rate_limits'; END IF;
END $$;
