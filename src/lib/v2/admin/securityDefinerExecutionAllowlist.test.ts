import { describe, it, expect } from "bun:test";
import {
  SECDEF_ANON_ALLOWLIST,
  SECDEF_ANON_ALLOWLIST_SIGNATURES,
  SECDEF_AUDITED_FUNCTIONS,
  SECDEF_AUTHENTICATED_ONLY,
  SECDEF_EXECUTION_ALLOWLIST as F,
  SECDEF_FINAL_MIGRATION,
  SECDEF_INITIAL_MIGRATION,
  SECDEF_TRIGGER_FUNCTIONS,
} from "./securityDefinerExecutionAllowlist.sql";

describe("SECURITY DEFINER execution allowlist — source fixture", () => {
  it("records both applied migrations with exact filenames", () => {
    expect(SECDEF_INITIAL_MIGRATION.applied).toBe(true);
    expect(SECDEF_INITIAL_MIGRATION.filename).toBe(
      "20260727141911_restrict_anonymous_security_definer_execution.sql",
    );
    expect(SECDEF_FINAL_MIGRATION.applied).toBe(true);
    expect(SECDEF_FINAL_MIGRATION.filename).toBe(
      "20260727142004_enforce_security_definer_execution_allowlist.sql",
    );
  });

  it("records that the initial migration was insufficient alone (PUBLIC inheritance)", () => {
    expect(SECDEF_INITIAL_MIGRATION.sufficientAlone).toBe(false);
    expect(SECDEF_INITIAL_MIGRATION.reasonInsufficient).toMatch(/PUBLIC/);
    expect(SECDEF_FINAL_MIGRATION.authoritative).toBe(true);
    expect(F.correctiveRelationship).toMatch(/20260727142004/);
    expect(F.correctiveRelationship).toMatch(/PUBLIC/);
  });

  it("has the exact six-function anonymous allowlist with exact pg_proc signatures", () => {
    const expectedSignatures = [
      "can_manage_prompts(uuid)",
      "get_public_profile_safe(uuid)",
      "get_public_prompt_previews(integer)",
      "get_public_resource_trust_badges(uuid[])",
      "has_role(uuid, app_role)",
      "is_admin()",
    ].sort();
    expect([...SECDEF_ANON_ALLOWLIST_SIGNATURES].sort()).toEqual(
      expectedSignatures,
    );
    expect(SECDEF_ANON_ALLOWLIST_SIGNATURES.length).toBe(6);

    const expectedNames = [
      "can_manage_prompts",
      "get_public_profile_safe",
      "get_public_prompt_previews",
      "get_public_resource_trust_badges",
      "has_role",
      "is_admin",
    ].sort();
    expect([...SECDEF_ANON_ALLOWLIST].sort()).toEqual(expectedNames);
    expect(SECDEF_ANON_ALLOWLIST.length).toBe(6);
  });

  it("does not allow any admin/internal helper to be anon-executable", () => {
    const forbiddenAnon = [
      "_v2_require_admin",
      "is_verified_admin",
      "is_super_admin",
      "is_admin_user",
      "cleanup_expired_data",
      "check_rate_limit",
      "get_user_profile_safe",
      "export_user_data",
      "validate_discount_code",
    ];
    for (const fn of forbiddenAnon) {
      expect(SECDEF_ANON_ALLOWLIST.includes(fn as never)).toBe(false);
    }
  });

  it("has the exact 20 authenticated+service_role internal helpers", () => {
    const expected = [
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
    ].sort();
    expect([...SECDEF_AUTHENTICATED_ONLY].sort()).toEqual(expected);
    expect(SECDEF_AUTHENTICATED_ONLY.length).toBe(20);
  });

  it("has the exact 8 trigger functions (service_role only)", () => {
    const expected = [
      "anonymize_audit_ip",
      "create_abandoned_cart_sequence",
      "ensure_single_active_subscription",
      "handle_new_user",
      "secure_admin_audit_insert",
      "secure_security_log_insert",
      "update_email_templates_updated_at",
      "update_platform_updated_at",
    ].sort();
    expect([...SECDEF_TRIGGER_FUNCTIONS].sort()).toEqual(expected);
    expect(SECDEF_TRIGGER_FUNCTIONS.length).toBe(8);
  });

  it("trigger functions are not executable by any browser role (anon/authenticated)", () => {
    for (const fn of SECDEF_TRIGGER_FUNCTIONS) {
      expect(SECDEF_ANON_ALLOWLIST.includes(fn as never)).toBe(false);
      expect(SECDEF_AUTHENTICATED_ONLY.includes(fn as never)).toBe(false);
    }
  });

  it("audited set totals 34 functions across three disjoint tiers (6 + 20 + 8)", () => {
    expect(SECDEF_AUDITED_FUNCTIONS.length).toBe(34);
    expect(F.totalAudited).toBe(34);
    expect(
      SECDEF_ANON_ALLOWLIST.length +
        SECDEF_AUTHENTICATED_ONLY.length +
        SECDEF_TRIGGER_FUNCTIONS.length,
    ).toBe(34);
    const seen = new Set<string>();
    for (const fn of SECDEF_AUDITED_FUNCTIONS) {
      expect(seen.has(fn)).toBe(false);
      seen.add(fn);
    }
  });
});
