/**
 * SOURCE FIXTURE — legacy SECURITY DEFINER authorization hardening.
 *
 * STATUS: DRAFTED, NOT APPLIED LIVE. Source-only. Intentionally not
 * wired to the supabase migration tool in this pass. Reviewers must
 * approve both this fixture, the physical SQL draft
 * (`docs/security/drafts/20260728120000_legacy_security_definer_authorization_hardening.sql`),
 * and the audit doc
 * (`docs/security/LEGACY_SECURITY_DEFINER_AUDIT_2026-07-28.md`) before
 * live application. The physical draft body is the canonical artifact;
 * `LEGACY_SECDEF_MIGRATION_SQL` re-exports its exact bytes so tests can
 * assert against a single source of truth.
 *
 * The 8 signatures below were reconciled to authoritative live
 * `pg_proc` evidence supplied by the caller. Two functions that older
 * drafts included — `execute_response_action(uuid, text, jsonb, jsonb)`
 * and `trigger_automated_response(text, text, jsonb)` — are already
 * `service_role`-only in live and are intentionally OMITTED here.
 * `admin_delete_user_data(uuid, uuid)` is likewise service_role-only
 * and is not referenced.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const LEGACY_SECDEF_MIGRATION = {
  version: "20260728120000",
  name: "legacy_security_definer_authorization_hardening",
  filename:
    "20260728120000_legacy_security_definer_authorization_hardening.sql",
  /**
   * Physical draft path in this repo. When approved, this file's exact
   * bytes will be submitted through the supabase migration tool, which
   * owns the canonical `supabase/migrations/<filename>` slot (writes to
   * that directory are blocked in the Lovable build environment).
   */
  draftPath:
    "docs/security/drafts/20260728120000_legacy_security_definer_authorization_hardening.sql",
  applied: false,
  drafted: true,
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
 * Byte-exact contents of the physical draft file. Tests use this to
 * assert every planned REVOKE / GRANT is actually present in the SQL a
 * reviewer will submit — no duplicated hand-maintained string.
 */
export const LEGACY_SECDEF_MIGRATION_SQL: string = readFileSync(
  join(process.cwd(), LEGACY_SECDEF_MIGRATION.draftPath),
  "utf8",
);

export const LEGACY_SECDEF_AUTHORIZATION = {
  migration: LEGACY_SECDEF_MIGRATION,
  tier1AuditLoggers: LEGACY_SECDEF_TIER1_AUDIT_LOGGERS,
  tier2Unreachable: LEGACY_SECDEF_TIER2_UNREACHABLE,
  tier3Investigate: LEGACY_SECDEF_TIER3_INVESTIGATE,
  alreadyServiceRoleOnly: LEGACY_SECDEF_ALREADY_SERVICE_ROLE_ONLY,
  sql: LEGACY_SECDEF_MIGRATION_SQL,
} as const;
