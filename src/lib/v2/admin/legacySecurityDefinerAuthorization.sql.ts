/**
 * SOURCE FIXTURE — legacy SECURITY DEFINER authorization hardening.
 *
 * STATUS: DRAFTED, NOT APPLIED LIVE. This file is source-only. It is
 * intentionally NOT wired to the supabase--migration tool in this pass.
 * A human must review the SQL below and the accompanying audit doc
 * (`docs/security/LEGACY_SECURITY_DEFINER_AUDIT_2026-07-28.md`) before
 * any live application.
 *
 * SCOPE — three disjoint tiers, all in schema `public`:
 *
 *   TIER 1 · AUDIT-LOG FUNCTIONS (revoke all browser roles)
 *     Zero active frontend or Edge callers were found (see audit doc
 *     §Group A). These functions previously allowed any authenticated
 *     browser session to write into `admin_audit_log`, including —
 *     for `log_sensitive_data_access` — a caller-supplied `admin_user_id`.
 *     After this migration only `service_role`/`postgres` may invoke
 *     them, so any future audit rows must originate from a server-side
 *     path we control.
 *
 *   TIER 2 · UNREACHABLE LEGACY HELPERS (revoke all browser roles)
 *     Every remaining `.rpc(...)` call site lives in dead utility
 *     modules under `src/utils/{incident,compliance,analytics}/*` with
 *     zero external importers (see audit doc §Group B). Revoking
 *     browser EXECUTE closes the direct-invoke surface without
 *     touching bodies or dependencies:
 *       - DB-internal SECURITY DEFINER callers (e.g. `handle_new_user`
 *         → `is_super_admin`, `trigger_automated_response` →
 *         `evaluate_response_conditions` / `execute_response_action`,
 *         `v2_internal_admin_roles_settings_summary` → `is_super_admin`)
 *         continue to work because they execute as the function owner,
 *         not the invoking browser role.
 *
 *   TIER 3 · CUSTOMER / RLS HELPERS (INVESTIGATE — no change in this
 *   migration)
 *     `can_access_prompt`, `can_access_tier`, `can_manage_prompts`,
 *     `get_user_subscription_tier`, `has_role`, `user_has_active_subscription`
 *     are quoted from RLS policy bodies and/or called from Edge
 *     Functions with an explicit `_user_id`. A body-level rebinding to
 *     `auth.uid()` risks changing RLS evaluation and the legitimate
 *     Edge admin-verification path. Following the "if ambiguous, keep
 *     and investigate" rule, this migration DOES NOT modify them. The
 *     audit doc records the follow-up guard proposal.
 *
 * IDEMPOTENCY: every statement is a `REVOKE ... IF EXISTS` on an exact
 * signature. Re-applying the file is a no-op.
 *
 * ROLLBACK (manual, only if a required internal caller regresses):
 *   GRANT EXECUTE ON FUNCTION public.<fn>(<sig>) TO authenticated;
 * The rollback grant list is enumerated in the audit doc §Rollback.
 */

export const LEGACY_SECDEF_MIGRATION = {
  version: "20260728120000",
  name: "legacy_security_definer_authorization_hardening",
  filename:
    "20260728120000_legacy_security_definer_authorization_hardening.sql",
  applied: false,
  drafted: true,
} as const;

/** TIER 1 — audit-log functions. Exact pg_proc signatures. */
export const LEGACY_SECDEF_TIER1_AUDIT_LOGGERS: readonly string[] = [
  "public.log_sensitive_data_access(uuid, text, uuid, text[])",
  "public.log_profile_access_attempt(uuid, text, boolean)",
] as const;

/** TIER 2 — unreachable legacy helpers. Exact pg_proc signatures. */
export const LEGACY_SECDEF_TIER2_UNREACHABLE: readonly string[] = [
  "public.calculate_anomaly_score(uuid, jsonb)",
  "public.confirm_user_email(uuid)",
  "public.evaluate_compliance_status(text, uuid)",
  "public.evaluate_response_conditions(jsonb, jsonb)",
  "public.execute_response_action(jsonb, jsonb)",
  "public.is_super_admin(uuid)",
  "public.trigger_automated_response(text, jsonb)",
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
 * The exact SQL body of the drafted migration. Kept in-source so tests
 * can assert grants/revokes; the file is NOT submitted to the migration
 * tool in this pass.
 */
export const LEGACY_SECDEF_MIGRATION_SQL = `-- 20260728120000_legacy_security_definer_authorization_hardening.sql
-- SOURCE-ONLY DRAFT. Do NOT apply without review. Idempotent.
--
-- TIER 1 · Audit-log functions — revoke every browser role. Only
-- service_role / postgres may write these audit rows going forward.

REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.log_sensitive_data_access(uuid, text, uuid, text[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.log_profile_access_attempt(uuid, text, boolean) TO service_role;

-- TIER 2 · Unreachable legacy helpers — revoke every browser role.
-- DB-internal SECURITY DEFINER callers keep working because they run
-- as the function owner, not as the invoking browser role.

REVOKE EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.calculate_anomaly_score(uuid, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.confirm_user_email(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_user_email(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_user_email(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_user_email(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_compliance_status(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_compliance_status(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_compliance_status(text, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.evaluate_compliance_status(text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.evaluate_response_conditions(jsonb, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.execute_response_action(jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_response_action(jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.execute_response_action(jsonb, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.execute_response_action(jsonb, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.trigger_automated_response(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_automated_response(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trigger_automated_response(text, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.trigger_automated_response(text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_has_any_role(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.user_has_any_role(uuid) TO service_role;

-- TIER 3 · Customer / RLS helpers — intentionally NOT modified in this
-- migration. See audit doc §Group C for the follow-up guard proposal.
`;

export const LEGACY_SECDEF_AUTHORIZATION = {
  migration: LEGACY_SECDEF_MIGRATION,
  tier1AuditLoggers: LEGACY_SECDEF_TIER1_AUDIT_LOGGERS,
  tier2Unreachable: LEGACY_SECDEF_TIER2_UNREACHABLE,
  tier3Investigate: LEGACY_SECDEF_TIER3_INVESTIGATE,
  sql: LEGACY_SECDEF_MIGRATION_SQL,
} as const;
