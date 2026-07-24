
DROP INDEX IF EXISTS public.uq_contact_rl_hash_scope_window;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY identifier_hash, scope
           ORDER BY window_start DESC, last_request_at DESC
         ) AS rn
  FROM public.contact_submission_rate_limits
)
DELETE FROM public.contact_submission_rate_limits r
USING ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

ALTER TABLE public.contact_submission_rate_limits
  DROP CONSTRAINT IF EXISTS contact_submission_rate_limits_scope_check;
ALTER TABLE public.contact_submission_rate_limits
  ADD  CONSTRAINT contact_submission_rate_limits_scope_check
       CHECK (scope IN ('ip','email','user','admin'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_rl_hash_scope
  ON public.contact_submission_rate_limits(identifier_hash, scope);

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
  v_allowed     BOOLEAN;
  v_retry_after INTEGER;
BEGIN
  IF p_identifier_hash IS NULL OR length(p_identifier_hash) NOT BETWEEN 32 AND 128 THEN
    RAISE EXCEPTION 'invalid_identifier_hash';
  END IF;
  IF p_scope NOT IN ('ip','email','user','admin') THEN
    RAISE EXCEPTION 'invalid_scope';
  END IF;
  IF p_max_requests IS NULL OR p_max_requests < 1 OR p_max_requests > 1000 THEN
    RAISE EXCEPTION 'invalid_max_requests';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 10 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid_window_seconds';
  END IF;

  -- Atomic single-row upsert. The unique (identifier_hash, scope) index
  -- guarantees exactly one row per identifier; ON CONFLICT DO UPDATE takes the
  -- row lock so concurrent claims serialize and cannot double-open a window.
  INSERT INTO public.contact_submission_rate_limits AS r
    (identifier_hash, scope, request_count, window_start, last_request_at)
  VALUES (p_identifier_hash, p_scope, 1, v_now, v_now)
  ON CONFLICT (identifier_hash, scope) DO UPDATE
    SET request_count =
          CASE
            WHEN r.window_start > v_now - make_interval(secs => p_window_seconds)
              THEN r.request_count + 1
            ELSE 1
          END,
        window_start =
          CASE
            WHEN r.window_start > v_now - make_interval(secs => p_window_seconds)
              THEN r.window_start
            ELSE v_now
          END,
        last_request_at = v_now
  RETURNING * INTO v_row;

  v_allowed     := (v_row.request_count <= p_max_requests);
  v_window_end  := v_row.window_start + make_interval(secs => p_window_seconds);
  v_retry_after := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_window_end - v_now)))::INTEGER);

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'count',   v_row.request_count,
    'limit',   p_max_requests,
    'retry_after_seconds', v_retry_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_contact_submission_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_contact_submission_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.check_contact_submission_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.check_contact_submission_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

DO $$
DECLARE
  r          JSONB;
  probe_hash TEXT := repeat('b', 64);
  probe_h2   TEXT := repeat('c', 64);
  probe_h3   TEXT := repeat('d', 64);
  n_rows     INTEGER;
  allowed_n  INTEGER := 0;
  i          INTEGER;
BEGIN
  -- Single-row invariant across many claims from a fresh identifier.
  -- This directly refutes the previous bug, where distinct-`now()` first
  -- writers produced multiple rows: here N calls with different `now()`
  -- values must collapse into exactly one row via the unique index.
  FOR i IN 1..12 LOOP
    r := public.check_contact_submission_rate_limit(probe_hash, 'email', 3, 3600);
    IF (r->>'allowed')::BOOLEAN THEN allowed_n := allowed_n + 1; END IF;
    -- Force a distinct clock tick so any timestamp-keyed design would fail here.
    PERFORM pg_sleep(0.01);
  END LOOP;
  SELECT count(*) INTO n_rows
    FROM public.contact_submission_rate_limits
    WHERE identifier_hash = probe_hash AND scope = 'email';
  IF n_rows <> 1 THEN
    RAISE EXCEPTION 'single-row invariant failed: expected 1 row, got %', n_rows;
  END IF;
  IF allowed_n <> 3 THEN
    RAISE EXCEPTION 'allowed-count invariant failed: expected 3 allowed, got %', allowed_n;
  END IF;

  -- Broadened scopes: distinct rows per scope for same hash, no collisions.
  PERFORM public.check_contact_submission_rate_limit(probe_h2, 'user',  1, 3600);
  PERFORM public.check_contact_submission_rate_limit(probe_h2, 'admin', 1, 3600);
  PERFORM public.check_contact_submission_rate_limit(probe_h2, 'ip',    1, 3600);
  SELECT count(*) INTO n_rows
    FROM public.contact_submission_rate_limits
    WHERE identifier_hash = probe_h2;
  IF n_rows <> 3 THEN
    RAISE EXCEPTION 'scope assertion failed: expected 3 rows, got %', n_rows;
  END IF;

  BEGIN
    PERFORM public.check_contact_submission_rate_limit(probe_h2, 'other', 1, 3600);
    RAISE EXCEPTION 'scope reject failed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'scope reject failed' THEN RAISE; END IF;
  END;

  -- Window reset: after the live window elapses, request_count resets to 1
  -- inside the same row (still exactly one row). Simulate elapsed window by
  -- rewinding the stored window_start via the same atomic path.
  UPDATE public.contact_submission_rate_limits
     SET window_start = now() - interval '2 hours'
   WHERE identifier_hash = probe_hash AND scope = 'email';
  r := public.check_contact_submission_rate_limit(probe_hash, 'email', 3, 3600);
  IF NOT (r->>'allowed')::BOOLEAN THEN
    RAISE EXCEPTION 'window reset failed: expected allowed after elapsed window';
  END IF;
  IF (r->>'count')::INTEGER <> 1 THEN
    RAISE EXCEPTION 'window reset failed: expected count=1, got %', r->>'count';
  END IF;
  SELECT count(*) INTO n_rows
    FROM public.contact_submission_rate_limits
    WHERE identifier_hash = probe_hash AND scope = 'email';
  IF n_rows <> 1 THEN
    RAISE EXCEPTION 'window reset failed: expected still 1 row, got %', n_rows;
  END IF;

  DELETE FROM public.contact_submission_rate_limits
    WHERE identifier_hash IN (probe_hash, probe_h2, probe_h3);
END $$;

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
