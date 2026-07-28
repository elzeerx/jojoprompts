/**
 * SOURCE FIXTURE — legacy SECURITY DEFINER authorization hardening.
 *
 * STATUS: APPLIED LIVE as migration version `20260728101016`. The
 * canonical byte-identical body has been copied from the draft path
 * into `supabase/migrations/20260728120000_legacy_security_definer_authorization_hardening.sql`;
 * the draft file is retained as an audit-trail artifact. The embedded
 * `LEGACY_SECDEF_MIGRATION_SQL` string below is enforced byte-identical
 * to the physical migration file by `legacySecurityDefinerAuthorization.test.ts`.
 *
 * POST-APPLY LIVE EVIDENCE (recorded 2026-07-28, source of truth):
 *   • All 8 target functions listed below now have
 *     authenticated_execute=false, anon_execute=false,
 *     service_role_execute=true (per pg_proc + has_function_privilege).
 *   • `admin_delete_user_data(uuid)` remains intentionally
 *     `authenticated`-callable; its SECURITY DEFINER body enforces
 *     `public.is_admin()`. The two-arg overload
 *     `admin_delete_user_data(uuid, uuid)` remains service_role-only.
 *
 * The 8 signatures below were reconciled to authoritative live
 * `pg_proc` evidence supplied by the caller. Two functions that older
 * drafts included — `execute_response_action(uuid, text, jsonb, jsonb)`
 * and `trigger_automated_response(text, text, jsonb)` — are already
 * `service_role`-only in live and are intentionally OMITTED here.
 * `admin_delete_user_data(uuid, uuid)` is likewise service_role-only
 * and is not referenced.
 */

export const LEGACY_SECDEF_MIGRATION = {
  version: "20260728120000",
  /** Live Supabase migration version recorded when this hardening was applied. */
  liveVersion: "20260728101016",
  name: "legacy_security_definer_authorization_hardening",
  filename:
    "20260728120000_legacy_security_definer_authorization_hardening.sql",
  /**
   * Canonical physical migration path. Bytes here are the applied
   * live body and are compared to `LEGACY_SECDEF_MIGRATION_SQL` by the
   * contract test.
   */
  migrationPath:
    "supabase/migrations/20260728120000_legacy_security_definer_authorization_hardening.sql",
  /**
   * Draft path retained as an audit-trail artifact. Kept byte-identical
   * to the canonical migration file; the contract test asserts parity.
   */
  draftPath:
    "docs/security/drafts/20260728120000_legacy_security_definer_authorization_hardening.sql",
  applied: true,
  drafted: false,
} as const;


/** TIER 1 — audit-log functions. Exact live pg_proc signatures. */
export const LEGACY_SECDEF_TIER1_AUDIT_LOGGERS: readonly string[] = [
  "public.log_sensitive_data_access(uuid, text, uuid, text[])",
  "public.log_profile_access_attempt(uuid, text, boolean)",
] as const;

/** TIER 2 — unreachable legacy helpers. Exact live pg_proc signatures. */
export const LEGACY_SECDEF_TIER2_UNREACHABLE: readonly string[] = [
  "public.calculate_anomaly_score(uuid, text, jsonb)",
  "public.confirm_user_email(uuid, boolean)",
  "public.evaluate_compliance_status(text, jsonb)",
  "public.evaluate_response_conditions(jsonb, jsonb)",
  "public.is_super_admin(uuid)",
  "public.user_has_any_role(uuid)",
] as const;

/** TIER 3 — customer/RLS helpers explicitly untouched here. */
export const LEGACY_SECDEF_TIER3_INVESTIGATE: readonly string[] = [
  "public.can_access_prompt(uuid, uuid)",
  "public.can_access_tier(uuid, text)",
  "public.can_manage_prompts(uuid)",
  "public.get_user_subscription_tier(uuid)",
  "public.has_role(uuid, app_role)",
  "public.user_has_active_subscription(uuid)",
] as const;

/**
 * Signatures already service_role-only per live pg_proc. Deliberately
 * absent from the revoke set — no migration statement is emitted for
 * them.
 */
export const LEGACY_SECDEF_ALREADY_SERVICE_ROLE_ONLY: readonly string[] = [
  "public.execute_response_action(uuid, text, jsonb, jsonb)",
  "public.trigger_automated_response(text, text, jsonb)",
  "public.admin_delete_user_data(uuid, uuid)",
] as const;

/**
 * Embedded copy of the physical draft file body. MUST remain
 * byte-identical to `docs/security/drafts/<filename>` — enforced by
 * `legacySecurityDefinerAuthorization.test.ts`, which reads the
 * physical file with `node:fs` at test time and compares. When editing
 * the migration, edit the `.sql` file first and paste the result here.
 */
export const LEGACY_SECDEF_MIGRATION_SQL = `-- 20260728120000_legacy_security_definer_authorization_hardening.sql
--
-- SOURCE-ONLY DRAFT. NOT APPLIED LIVE in this pass. A human must review
-- this file and docs/security/LEGACY_SECURITY_DEFINER_AUDIT_2026-07-28.md
-- before submission to the supabase migration tool.
--
-- NOTE ON FILE LOCATION: the Lovable build environment blocks direct
-- writes under \`supabase/migrations/\`. This physical file therefore
-- lives at \`docs/security/drafts/\` for reviewer inspection. When
-- approved, its byte-identical body will be submitted through the
-- supabase migration tool, which owns the canonical
-- \`supabase/migrations/20260728120000_...sql\` path.
--
-- Scope: schema \`public\`. Revoke browser (PUBLIC / anon / authenticated)
-- EXECUTE on 8 legacy SECURITY DEFINER helpers that live pg_proc

-- evidence shows are currently exposed to the \`authenticated\` role, and
-- retain / grant EXECUTE to \`service_role\` only. No function bodies,
-- signatures, or dependent RLS policies are modified.
--
-- Exact live signatures (from pg_proc at draft time):
--   TIER 1 · audit-log functions
--     public.log_sensitive_data_access(uuid, text, uuid, text[])
--     public.log_profile_access_attempt(uuid, text, boolean)
--   TIER 2 · unreachable legacy helpers
--     public.calculate_anomaly_score(uuid, text, jsonb)
--     public.confirm_user_email(uuid, boolean)
--     public.evaluate_compliance_status(text, jsonb)
--     public.evaluate_response_conditions(jsonb, jsonb)
--     public.is_super_admin(uuid)
--     public.user_has_any_role(uuid)
--
-- Explicitly EXCLUDED (already service_role-only per live pg_proc — no
-- change required, no statement emitted below):
--     public.execute_response_action(uuid, text, jsonb, jsonb)
--     public.trigger_automated_response(text, text, jsonb)
--     public.admin_delete_user_data(uuid, uuid)
--
-- Idempotence: \`REVOKE EXECUTE\` on an unprivileged role is a no-op and
-- \`GRANT EXECUTE\` to \`service_role\` on an already-granted function is a
-- no-op, so this file may be re-run safely. PostgreSQL does not support
-- \`REVOKE ... IF EXISTS\` for function privileges; do not add that
-- syntax.

-- ── TIER 1 · Audit-log functions ─────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) TO service_role;

-- ── TIER 2 · Unreachable legacy helpers ──────────────────────────────

REVOKE EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, text, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_user_email(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_user_email(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_user_email(uuid, boolean) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_user_email(uuid, boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_compliance_status(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_compliance_status(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_compliance_status(text, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.evaluate_compliance_status(text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.user_has_any_role(uuid) TO service_role;

-- TIER 3 · Customer / RLS helpers (can_access_prompt, can_access_tier,
-- can_manage_prompts, get_user_subscription_tier, has_role,
-- user_has_active_subscription) are intentionally NOT modified here.
-- See docs/security/LEGACY_SECURITY_DEFINER_AUDIT_2026-07-28.md §Group C
-- for the follow-up guard proposal to be delivered in a separate
-- reviewed migration.
`;

export const LEGACY_SECDEF_AUTHORIZATION = {
  migration: LEGACY_SECDEF_MIGRATION,
  tier1AuditLoggers: LEGACY_SECDEF_TIER1_AUDIT_LOGGERS,
  tier2Unreachable: LEGACY_SECDEF_TIER2_UNREACHABLE,
  tier3Investigate: LEGACY_SECDEF_TIER3_INVESTIGATE,
  alreadyServiceRoleOnly: LEGACY_SECDEF_ALREADY_SERVICE_ROLE_ONLY,
  sql: LEGACY_SECDEF_MIGRATION_SQL,
} as const;
