/**
 * SOURCE FIXTURE — pre-launch hardening for `public.security_logs`.
 *
 * NOT applied to production in this pass. Held here as a
 * version-controlled record of the intended additive migration so that
 * (a) the SQL is testable without running it and (b) callers can be
 * audited against a known contract.
 *
 * Intended future filename (when application is approved):
 *   supabase/migrations/20260728010000_security_logs_write_hardening.sql
 *
 * SCOPE (defensive, additive, idempotent where practical):
 *   • Drop any INSERT policy on public.security_logs that grants
 *     anon or authenticated (browser roles).
 *   • REVOKE INSERT on public.security_logs from anon and authenticated.
 *   • service_role INSERT preserved (server-side / Edge Functions).
 *   • Existing admin/own SELECT policies preserved verbatim —
 *     admin dashboards (Communications MonitoringAlertsPanel, admin
 *     SecurityMonitoringDashboard) continue to read security_logs
 *     through the same policies they already use.
 *
 * OUT OF SCOPE — do NOT touch in this migration:
 *   • activity_events, payment_events, orders, entitlements,
 *     resources, users, storage.objects, or any bucket flag.
 *   • Existing SELECT policies on security_logs (no read broadening).
 *   • Any Edge Function or server-side writer.
 *
 * Rollback: restore the two dropped policies from git history and
 * re-grant INSERT to authenticated. No data migration is involved.
 */

export const SECURITY_LOGS_HARDENING_MIGRATION_FILENAME =
  "20260728010000_security_logs_write_hardening.sql";

export const SECURITY_LOGS_HARDENING_SQL = `-- V2 pre-launch hardening: block browser-role writes to
-- public.security_logs. Server-side/service_role paths are preserved.

-- 1) Drop any policy that grants INSERT to anon or authenticated on
--    public.security_logs. Names are best-effort — DROP IF EXISTS
--    keeps the statement idempotent.
DROP POLICY IF EXISTS "Users can insert own security logs"     ON public.security_logs;
DROP POLICY IF EXISTS "Authenticated can insert security logs" ON public.security_logs;
DROP POLICY IF EXISTS "Anyone can insert security logs"        ON public.security_logs;
DROP POLICY IF EXISTS "System can insert security logs"        ON public.security_logs;
DROP POLICY IF EXISTS "security_logs_insert"                   ON public.security_logs;

-- 2) Revoke direct table-level INSERT from browser roles.
REVOKE INSERT ON public.security_logs FROM anon;
REVOKE INSERT ON public.security_logs FROM authenticated;

-- 3) Preserve service_role write path explicitly.
GRANT INSERT, SELECT ON public.security_logs TO service_role;

-- 4) Existing admin/own SELECT policies are NOT touched. This
--    migration must not broaden reads and must not alter any other
--    table. RLS remains enabled.
`;

export const SECURITY_LOGS_HARDENING = {
  filename: SECURITY_LOGS_HARDENING_MIGRATION_FILENAME,
  sql: SECURITY_LOGS_HARDENING_SQL,
} as const;
