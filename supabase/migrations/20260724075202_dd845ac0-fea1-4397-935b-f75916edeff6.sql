-- Forward-only security cleanup for private schema
-- No customer data is touched. Preserves the four private functions.

-- 1) Drop temporary rehearsal log if it exists
DROP TABLE IF EXISTS private._rehearsal_log;

-- 2) Revoke all privileges from supabase_read_only_user on private schema objects
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_read_only_user') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA private FROM supabase_read_only_user';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM supabase_read_only_user';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM supabase_read_only_user';
    EXECUTE 'REVOKE ALL ON SCHEMA private FROM supabase_read_only_user';
    -- Also revoke any default privileges that might grant future access
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON TABLES FROM supabase_read_only_user';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON SEQUENCES FROM supabase_read_only_user';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON FUNCTIONS FROM supabase_read_only_user';
  END IF;
END $$;

-- 3) Re-assert baseline lockdown on private schema (idempotent; matches prior policy)
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
