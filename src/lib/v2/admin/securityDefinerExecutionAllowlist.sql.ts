/**
 * SOURCE FIXTURE — pre-launch hardening of EXECUTE privileges on public
 * SECURITY DEFINER functions.
 *
 * APPLIED LIVE (two migrations, applied in order):
 *
 *   1) 20260727141911 restrict_anonymous_security_definer_execution
 *      Initial pass. Explicitly `REVOKE ... FROM anon` on the 34 audited
 *      SECURITY DEFINER functions in the `public` schema.
 *      INSUFFICIENT ALONE: PostgreSQL grants EXECUTE to role `PUBLIC`
 *      by default on functions, and every login role (`anon`,
 *      `authenticated`, `service_role`, etc.) inherits `PUBLIC`. Because
 *      that first pass did NOT revoke `PUBLIC`, the anonymous browser
 *      role could still execute the functions via the inherited grant.
 *
 *   2) 20260727142004 enforce_security_definer_execution_allowlist
 *      Authoritative final state. For every one of the 34 audited
 *      SECURITY DEFINER functions:
 *          REVOKE EXECUTE ON FUNCTION public.<fn>(<sig>) FROM PUBLIC;
 *          REVOKE EXECUTE ON FUNCTION public.<fn>(<sig>) FROM anon;
 *          REVOKE EXECUTE ON FUNCTION public.<fn>(<sig>) FROM authenticated;
 *      Then explicit allowlist GRANTs re-establish exactly the intended
 *      access matrix — nothing broader.
 *
 * FINAL ACCESS MATRIX (verified from pg_proc; encoded below; tests
 * assert exactly this):
 *
 *   ANON-EXECUTABLE (6, exact signatures):
 *     - can_manage_prompts(uuid)
 *     - get_public_profile_safe(uuid)
 *     - get_public_prompt_previews(integer)
 *     - get_public_resource_trust_badges(uuid[])
 *     - has_role(uuid, app_role)
 *     - is_admin()
 *
 *   AUTHENTICATED + SERVICE_ROLE ONLY (20 internal helpers, by name):
 *     Callable by signed-in users through client/RPC paths that are
 *     already gated by app-level auth checks. Never anon-callable.
 *
 *   SERVICE_ROLE ONLY (8 trigger functions, by name):
 *     Fire from DB triggers as owner; must not be directly executable
 *     by any browser role.
 *
 * OUT OF SCOPE — this fixture must NOT reference:
 *   • RLS policy bodies, table GRANTs, or storage.* objects.
 *   • Any change to function bodies, arg signatures, or SECURITY model.
 *   • Any addition of new SECURITY DEFINER functions.
 *
 * Corrective relationship recorded: (1) alone left PUBLIC EXECUTE intact
 * and was therefore not sufficient; (2) added the `REVOKE ... FROM
 * PUBLIC` on every audited function and the explicit allowlist grants,
 * which together produce the invariant tested here.
 */

export const SECDEF_INITIAL_MIGRATION = {
  version: "20260727141911",
  name: "restrict_anonymous_security_definer_execution",
  filename:
    "20260727141911_restrict_anonymous_security_definer_execution.sql",
  applied: true,
  sufficientAlone: false,
  reasonInsufficient:
    "Only revoked from role anon; PUBLIC still held EXECUTE, and every login role inherits PUBLIC.",
} as const;

export const SECDEF_FINAL_MIGRATION = {
  version: "20260727142004",
  name: "enforce_security_definer_execution_allowlist",
  filename:
    "20260727142004_enforce_security_definer_execution_allowlist.sql",
  applied: true,
  authoritative: true,
} as const;

/**
 * Exact six-function anonymous allowlist, with exact argument signatures
 * as verified in live pg_proc. Content-exact; order-insensitive.
 */
export const SECDEF_ANON_ALLOWLIST_SIGNATURES: readonly string[] = [
  "can_manage_prompts(uuid)",
  "get_public_profile_safe(uuid)",
  "get_public_prompt_previews(integer)",
  "get_public_resource_trust_badges(uuid[])",
  "has_role(uuid, app_role)",
  "is_admin()",
] as const;

/** Bare function names for the six-entry anon allowlist. */
export const SECDEF_ANON_ALLOWLIST: readonly string[] = [
  "can_manage_prompts",
  "get_public_profile_safe",
  "get_public_prompt_previews",
  "get_public_resource_trust_badges",
  "has_role",
  "is_admin",
] as const;

/** 20 internal helpers: authenticated + service_role only. */
export const SECDEF_AUTHENTICATED_ONLY: readonly string[] = [
  "calculate_anomaly_score",
  "can_access_prompt",
  "can_access_sensitive_profile_data",
  "can_access_tier",
  "cancel_user_subscription",
  "cleanup_orphaned_security_logs",
  "confirm_user_email",
  "evaluate_compliance_status",
  "evaluate_response_conditions",
  "export_user_data",
  "get_user_profile_safe",
  "get_user_subscription_tier",
  "has_active_subscription",
  "is_admin_user",
  "is_super_admin",
  "is_verified_admin",
  "log_profile_access_attempt",
  "user_has_active_subscription",
  "user_has_any_role",
  "validate_discount_code",
] as const;

/** 8 trigger functions: service_role only (no browser-role execute). */
export const SECDEF_TRIGGER_FUNCTIONS: readonly string[] = [
  "anonymize_audit_ip",
  "create_abandoned_cart_sequence",
  "ensure_single_active_subscription",
  "handle_new_user",
  "secure_admin_audit_insert",
  "secure_security_log_insert",
  "update_email_templates_updated_at",
  "update_platform_updated_at",
] as const;

/** Full audited set — 34 functions across three disjoint tiers. */
export const SECDEF_AUDITED_FUNCTIONS: readonly string[] = [
  ...SECDEF_ANON_ALLOWLIST,
  ...SECDEF_AUTHENTICATED_ONLY,
  ...SECDEF_TRIGGER_FUNCTIONS,
] as const;

export const SECDEF_EXECUTION_ALLOWLIST = {
  initial: SECDEF_INITIAL_MIGRATION,
  final: SECDEF_FINAL_MIGRATION,
  anon: SECDEF_ANON_ALLOWLIST,
  anonSignatures: SECDEF_ANON_ALLOWLIST_SIGNATURES,
  authenticated: SECDEF_AUTHENTICATED_ONLY,
  triggers: SECDEF_TRIGGER_FUNCTIONS,
  audited: SECDEF_AUDITED_FUNCTIONS,
  totalAudited: 34,
  correctiveRelationship:
    "20260727141911 was superseded by 20260727142004 which additionally REVOKEs EXECUTE FROM PUBLIC.",
} as const;
