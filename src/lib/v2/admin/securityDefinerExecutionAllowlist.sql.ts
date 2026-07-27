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
 * FINAL ACCESS MATRIX (encoded below; tests assert exactly this):
 *
 *   ANON-EXECUTABLE (6, unchanged public surfaces):
 *     - can_manage_prompts(uuid)
 *     - has_role(uuid, app_role)
 *     - is_admin(uuid)
 *     - get_public_profile_safe(uuid)
 *     - get_public_prompt_previews(int, int)
 *     - get_public_resource_trust_badges(uuid)
 *
 *   AUTHENTICATED + SERVICE_ROLE ONLY (20 internal helpers):
 *     Callable by signed-in users through client/RPC paths that are
 *     already gated by app-level auth checks. Never anon-callable.
 *
 *   SERVICE_ROLE ONLY (8 trigger functions):
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
 *
 * Rollback: reverse the REVOKE PUBLIC / role-scoped GRANTs in (2). The
 * database catalog default (EXECUTE to PUBLIC) will be re-established
 * for anything not explicitly re-granted.
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

/** Exact six-function anonymous allowlist. Order-insensitive; content-exact. */
export const SECDEF_ANON_ALLOWLIST: readonly string[] = [
  "can_manage_prompts",
  "has_role",
  "is_admin",
  "get_public_profile_safe",
  "get_public_prompt_previews",
  "get_public_resource_trust_badges",
] as const;

/** 20 internal helpers: authenticated + service_role only. */
export const SECDEF_AUTHENTICATED_ONLY: readonly string[] = [
  "authorize_resource_download",
  "can_access_prompt",
  "can_access_sensitive_profile_data",
  "can_access_tier",
  "cancel_user_subscription",
  "confirm_user_email",
  "delete_user_account",
  "evaluate_access_request",
  "export_user_data",
  "get_my_downloadable_files",
  "get_my_inactive_entitlements",
  "get_my_library_state",
  "get_user_profile_safe",
  "get_user_subscription_tier",
  "has_active_subscription",
  "is_admin_user",
  "is_super_admin",
  "is_verified_admin",
  "user_has_active_subscription",
  "user_has_any_role",
] as const;

/** 8 trigger functions: service_role only (no browser-role execute). */
export const SECDEF_TRIGGER_FUNCTIONS: readonly string[] = [
  "handle_new_user",
  "ensure_single_active_subscription",
  "anonymize_audit_ip",
  "anonymize_ip_address",
  "log_profile_access_attempt",
  "log_sensitive_data_access",
  "update_abandoned_cart_updated_at",
  "set_package_scan_items_updated_at",
] as const;

/** Full audited set — 34 functions. */
export const SECDEF_AUDITED_FUNCTIONS: readonly string[] = [
  ...SECDEF_ANON_ALLOWLIST,
  ...SECDEF_AUTHENTICATED_ONLY,
  ...SECDEF_TRIGGER_FUNCTIONS,
] as const;

export const SECDEF_EXECUTION_ALLOWLIST = {
  initial: SECDEF_INITIAL_MIGRATION,
  final: SECDEF_FINAL_MIGRATION,
  anon: SECDEF_ANON_ALLOWLIST,
  authenticated: SECDEF_AUTHENTICATED_ONLY,
  triggers: SECDEF_TRIGGER_FUNCTIONS,
  audited: SECDEF_AUDITED_FUNCTIONS,
  totalAudited: 34,
  correctiveRelationship:
    "20260727141911 was superseded by 20260727142004 which additionally REVOKEs EXECUTE FROM PUBLIC.",
} as const;
