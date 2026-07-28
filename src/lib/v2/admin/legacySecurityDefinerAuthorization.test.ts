import { describe, expect, it } from "bun:test";
import {
  LEGACY_SECDEF_AUTHORIZATION,
  LEGACY_SECDEF_MIGRATION,
  LEGACY_SECDEF_MIGRATION_SQL,
  LEGACY_SECDEF_TIER1_AUDIT_LOGGERS,
  LEGACY_SECDEF_TIER2_UNREACHABLE,
  LEGACY_SECDEF_TIER3_INVESTIGATE,
} from "./legacySecurityDefinerAuthorization.sql";
import { SECDEF_ANON_ALLOWLIST } from "./securityDefinerExecutionAllowlist.sql";

const SQL = LEGACY_SECDEF_MIGRATION_SQL;

function nameOf(sig: string): string {
  return sig.replace(/^public\./, "").split("(")[0];
}

describe("legacy SECURITY DEFINER authorization hardening — drafted migration", () => {
  it("is marked drafted and NOT applied live", () => {
    expect(LEGACY_SECDEF_MIGRATION.applied).toBe(false);
    expect(LEGACY_SECDEF_MIGRATION.drafted).toBe(true);
  });

  it("keeps the three tiers disjoint", () => {
    const t1 = new Set(LEGACY_SECDEF_TIER1_AUDIT_LOGGERS.map(nameOf));
    const t2 = new Set(LEGACY_SECDEF_TIER2_UNREACHABLE.map(nameOf));
    const t3 = new Set(LEGACY_SECDEF_TIER3_INVESTIGATE.map(nameOf));
    for (const n of t1) {
      expect(t2.has(n)).toBe(false);
      expect(t3.has(n)).toBe(false);
    }
    for (const n of t2) expect(t3.has(n)).toBe(false);
  });

  it("never references admin_delete_user_data (service_role-only already)", () => {
    expect(/admin_delete_user_data/.test(SQL)).toBe(false);
  });

  it("never revokes has_role (RLS + edge admin verification dependency)", () => {
    expect(/REVOKE[^\n]*\bhas_role\s*\(/.test(SQL)).toBe(false);
  });

  it("performs no function body / signature changes (privilege change only)", () => {
    expect(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i.test(SQL)).toBe(false);
    expect(/ALTER\s+FUNCTION/i.test(SQL)).toBe(false);
    expect(/DROP\s+FUNCTION/i.test(SQL)).toBe(false);
  });

  it("preserves the RLS-critical prompts helpers untouched", () => {
    for (const fn of ["can_access_prompt", "can_manage_prompts", "has_role"]) {
      const re = new RegExp(`REVOKE[^\\n]*\\b${fn}\\s*\\(`);
      expect(re.test(SQL)).toBe(false);
    }
  });

  it("revokes PUBLIC, anon, and authenticated for every Tier 1 + Tier 2 signature and grants service_role", () => {
    for (const sig of [
      ...LEGACY_SECDEF_TIER1_AUDIT_LOGGERS,
      ...LEGACY_SECDEF_TIER2_UNREACHABLE,
    ]) {
      const fn = nameOf(sig);
      for (const role of ["PUBLIC", "anon", "authenticated"]) {
        const re = new RegExp(
          `REVOKE EXECUTE ON FUNCTION public\\.${fn}\\b[^;]*FROM ${role}`,
        );
        expect(re.test(SQL)).toBe(true);
      }
      const grantRe = new RegExp(
        `GRANT\\s+EXECUTE ON FUNCTION public\\.${fn}\\b[^;]*TO service_role`,
      );
      expect(grantRe.test(SQL)).toBe(true);
    }
  });

  it("forbids caller-supplied audit actors by removing authenticated access to log_sensitive_data_access", () => {
    expect(
      /REVOKE EXECUTE ON FUNCTION public\.log_sensitive_data_access\(uuid, text, uuid, text\[\]\) FROM authenticated/.test(
        SQL,
      ),
    ).toBe(true);
  });

  it("does not touch the six-entry anonymous allowlist from the prior hardening pass", () => {
    for (const anonFn of SECDEF_ANON_ALLOWLIST) {
      const re = new RegExp(`REVOKE[^\\n]*\\b${anonFn}\\s*\\(`);
      expect(re.test(SQL)).toBe(false);
    }
  });

  it("aggregates the drafted SQL under a single exported object", () => {
    expect(LEGACY_SECDEF_AUTHORIZATION.sql).toBe(SQL);
    expect(LEGACY_SECDEF_AUTHORIZATION.migration.applied).toBe(false);
  });
});
