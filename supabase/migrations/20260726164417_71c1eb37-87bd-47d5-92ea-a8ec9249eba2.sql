-- Idempotent sync of already-applied production hardening for
-- public.admin_audit_log and public.log_sensitive_data_access.
-- Safe to re-run: uses IF EXISTS / DROP + CREATE patterns and role-scoped grants.

-- 1. Revoke all privileges on admin_audit_log from anon.
REVOKE ALL PRIVILEGES ON TABLE public.admin_audit_log FROM anon;

-- 2. Drop legacy overly-permissive insert policy if present.
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.admin_audit_log;

-- 3. Preserve the "Admins can view audit logs" SELECT policy but scope it
--    strictly TO authenticated. Drop and recreate to guarantee the role list
--    matches, regardless of prior definition.
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;

CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_log
FOR SELECT
TO authenticated
USING (public.is_verified_admin('view_audit_logs'));

-- 4. Revoke EXECUTE on log_sensitive_data_access from PUBLIC and anon.
REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) FROM anon;

-- 5. Preserve authenticated + service_role EXECUTE on the RPC (idempotent grants).
GRANT EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) TO service_role;

-- Preserve service_role full table access (bypasses RLS via role privileges
-- as well as BYPASSRLS; this grant is a belt-and-suspenders no-op re-affirmation).
GRANT ALL ON TABLE public.admin_audit_log TO service_role;