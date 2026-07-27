/**
 * SOURCE FIXTURE — pre-launch client-write restriction for
 * `public.security_logs`.
 *
 * NOT applied to production. Held as a version-controlled record of the
 * intended additive migration so the SQL is testable without executing
 * it. The intended future filename is:
 *
 *   supabase/migrations/20260727150000_restrict_security_logs_client_writes.sql
 *
 * SCOPE (exact — do not broaden):
 *   • DROP the two known legacy INSERT policies on public.security_logs
 *     by their EXACT current names:
 *       - "Anonymous users can insert anonymous security logs"
 *       - "Authenticated users can insert own security logs"
 *   • REVOKE INSERT, UPDATE, DELETE on public.security_logs from anon
 *     and authenticated. SELECT grants are intentionally NOT touched —
 *     the admin/own SELECT policies remain the sole read path.
 *   • GRANT ALL on public.security_logs to service_role so
 *     server-side / Edge Function writers keep the same access.
 *   • Preserve every existing admin/own SELECT policy verbatim.
 *
 * OUT OF SCOPE — the fixture must NOT reference:
 *   • activity_events, payment_events, orders, entitlements,
 *     resources, users, storage.objects, storage.buckets, or any
 *     bucket flag.
 *   • Any additional CREATE POLICY on security_logs (no read
 *     broadening).
 *   • Any Edge Function or server-side writer path.
 *
 * Rollback: restore the two dropped policies from git history and
 * re-grant INSERT/UPDATE/DELETE to authenticated. No data migration is
 * involved.
 */

export const SECURITY_LOGS_CLIENT_WRITE_RESTRICTION_MIGRATION_FILENAME =
  "20260727150000_restrict_security_logs_client_writes.sql";

export const SECURITY_LOGS_CLIENT_WRITE_RESTRICTION_APPLIED = false;

export const SECURITY_LOGS_CLIENT_WRITE_RESTRICTION_SQL = `-- V2 pre-launch hardening: restrict client (anon/authenticated) writes
-- to public.security_logs. Server-side / service_role writers keep full
-- access. Admin/own SELECT policies are preserved untouched.

-- 1) Drop the two known legacy INSERT policies by their exact names.
DROP POLICY IF EXISTS "Anonymous users can insert anonymous security logs" ON public.security_logs;
DROP POLICY IF EXISTS "Authenticated users can insert own security logs"   ON public.security_logs;

-- 2) Revoke direct table-level write privileges from browser roles.
REVOKE INSERT, UPDATE, DELETE ON public.security_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.security_logs FROM authenticated;

-- 3) Preserve service_role write path explicitly.
GRANT ALL ON public.security_logs TO service_role;

-- 4) Existing admin/own SELECT policies are intentionally NOT touched.
--    RLS remains enabled on public.security_logs.
`;

export const SECURITY_LOGS_CLIENT_WRITE_RESTRICTION = {
  filename: SECURITY_LOGS_CLIENT_WRITE_RESTRICTION_MIGRATION_FILENAME,
  sql: SECURITY_LOGS_CLIENT_WRITE_RESTRICTION_SQL,
  applied: SECURITY_LOGS_CLIENT_WRITE_RESTRICTION_APPLIED,
} as const;
