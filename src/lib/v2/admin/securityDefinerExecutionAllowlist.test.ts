import { describe, it, expect } from "bun:test";
import {
  SECDEF_ANON_ALLOWLIST,
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

  it("has the exact six-function anonymous allowlist (content-exact, no broadening)", () => {
    const expected = [
      "can_manage_prompts",
      "has_role",
      "is_admin",
      "get_public_profile_safe",
      "get_public_prompt_previews",
      "get_public_resource_trust_badges",
    ].sort();
    expect([...SECDEF_ANON_ALLOWLIST].sort()).toEqual(expected);
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
      "authorize_resource_download",
      "get_user_profile_safe",
      "delete_user_account",
      "export_user_data",
    ];
    for (const fn of forbiddenAnon) {
      expect(SECDEF_ANON_ALLOWLIST.includes(fn as never)).toBe(false);
    }
  });

  it("classifies 20 authenticated+service_role helpers and 8 trigger functions", () => {
    expect(SECDEF_AUTHENTICATED_ONLY.length).toBe(20);
    expect(SECDEF_TRIGGER_FUNCTIONS.length).toBe(8);
  });

  it("trigger functions are not executable by any browser role (anon/authenticated)", () => {
    for (const fn of SECDEF_TRIGGER_FUNCTIONS) {
      expect(SECDEF_ANON_ALLOWLIST.includes(fn as never)).toBe(false);
      expect(SECDEF_AUTHENTICATED_ONLY.includes(fn as never)).toBe(false);
    }
  });

  it("audited set totals 34 functions across three disjoint tiers", () => {
    expect(SECDEF_AUDITED_FUNCTIONS.length).toBe(34);
    expect(F.totalAudited).toBe(34);
    const seen = new Set<string>();
    for (const fn of SECDEF_AUDITED_FUNCTIONS) {
      expect(seen.has(fn)).toBe(false);
      seen.add(fn);
    }
  });
});
