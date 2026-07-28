// Test-only: read the physical draft file to assert byte parity with
// the embedded fixture. Bun provides these at runtime; declared inline
// so the strict tsc pass does not need `@types/node` visibility.
declare const process: { cwd(): string };
// @ts-expect-error - node builtin resolved by Bun at test runtime
import { readFileSync } from "node:fs";
// @ts-expect-error - node builtin resolved by Bun at test runtime
import { join } from "node:path";

import { describe, expect, it } from "bun:test";
import {
  LEGACY_SECDEF_ALREADY_SERVICE_ROLE_ONLY,
  LEGACY_SECDEF_AUTHORIZATION,
  LEGACY_SECDEF_MIGRATION,
  LEGACY_SECDEF_MIGRATION_SQL,
  LEGACY_SECDEF_TIER1_AUDIT_LOGGERS,
  LEGACY_SECDEF_TIER2_UNREACHABLE,
  LEGACY_SECDEF_TIER3_INVESTIGATE,
} from "./legacySecurityDefinerAuthorization.sql";
import { SECDEF_ANON_ALLOWLIST } from "./securityDefinerExecutionAllowlist.sql";

const PHYSICAL_SQL = readFileSync(
  join(process.cwd(), LEGACY_SECDEF_MIGRATION.draftPath),
  "utf8",
);
const SQL = LEGACY_SECDEF_MIGRATION_SQL;

function nameOf(sig: string): string {
  return sig.replace(/^public\./, "").split("(")[0];
}

/** Turn `public.fn(uuid, text)` into a regex-safe literal for the SQL body. */
function sigLiteral(sig: string): string {
  return sig.replace(/^public\./, "public.");
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("legacy SECURITY DEFINER authorization hardening — drafted migration", () => {
  it("is marked drafted and NOT applied live", () => {
    expect(LEGACY_SECDEF_MIGRATION.applied).toBe(false);
    expect(LEGACY_SECDEF_MIGRATION.drafted).toBe(true);
    expect(LEGACY_SECDEF_MIGRATION.filename).toBe(
      "20260728120000_legacy_security_definer_authorization_hardening.sql",
    );
  });

  it("embedded SQL is byte-identical to the physical draft file", () => {
    // Single source of truth: the .sql file. Fixture string is a mirror.
    expect(SQL).toBe(PHYSICAL_SQL);
  });

  it("proposes exactly 8 unique signatures across Tier 1 + Tier 2", () => {
    const all = [
      ...LEGACY_SECDEF_TIER1_AUDIT_LOGGERS,
      ...LEGACY_SECDEF_TIER2_UNREACHABLE,
    ];
    expect(all.length).toBe(8);
    expect(new Set(all).size).toBe(8);
  });

  it("keeps the three tiers disjoint and disjoint from already-service-role-only", () => {
    const t1 = new Set(LEGACY_SECDEF_TIER1_AUDIT_LOGGERS.map(nameOf));
    const t2 = new Set(LEGACY_SECDEF_TIER2_UNREACHABLE.map(nameOf));
    const t3 = new Set(LEGACY_SECDEF_TIER3_INVESTIGATE.map(nameOf));
    const already = new Set(
      LEGACY_SECDEF_ALREADY_SERVICE_ROLE_ONLY.map(nameOf),
    );
    for (const n of t1) {
      expect(t2.has(n)).toBe(false);
      expect(t3.has(n)).toBe(false);
      expect(already.has(n)).toBe(false);
    }
    for (const n of t2) {
      expect(t3.has(n)).toBe(false);
      expect(already.has(n)).toBe(false);
    }
    for (const n of t3) expect(already.has(n)).toBe(false);
  });

  it("emits REVOKE from PUBLIC/anon/authenticated and GRANT to service_role for every proposed signature", () => {
    for (const sig of [
      ...LEGACY_SECDEF_TIER1_AUDIT_LOGGERS,
      ...LEGACY_SECDEF_TIER2_UNREACHABLE,
    ]) {
      const lit = esc(sigLiteral(sig));
      for (const role of ["PUBLIC", "anon", "authenticated"]) {
        const re = new RegExp(`REVOKE EXECUTE ON FUNCTION ${lit} FROM ${role};`);
        expect(re.test(SQL)).toBe(true);
      }
      const grantRe = new RegExp(
        `GRANT\\s+EXECUTE ON FUNCTION ${lit} TO service_role;`,
      );
      expect(grantRe.test(SQL)).toBe(true);
    }
  });

  it("does not reference the already-service-role-only signatures at all", () => {
    // Signature-level absence: no REVOKE/GRANT statement targets them.
    for (const sig of LEGACY_SECDEF_ALREADY_SERVICE_ROLE_ONLY) {
      const fn = nameOf(sig);
      // These function *names* may only appear inside comment lines
      // (documenting the exclusion). No REVOKE/GRANT line may target them.
      const stmtRe = new RegExp(
        `^\\s*(REVOKE|GRANT)[^\\n]*\\b${fn}\\s*\\(`,
        "m",
      );
      expect(stmtRe.test(SQL)).toBe(false);
    }
  });

  it("never touches admin_delete_user_data in a privilege statement", () => {
    expect(/^\s*(REVOKE|GRANT)[^\n]*\badmin_delete_user_data\s*\(/m.test(SQL)).toBe(
      false,
    );
  });

  it("preserves the RLS-critical Tier 3 helpers untouched", () => {
    for (const fn of LEGACY_SECDEF_TIER3_INVESTIGATE.map(nameOf)) {
      const re = new RegExp(`^\\s*(REVOKE|GRANT)[^\\n]*\\b${fn}\\s*\\(`, "m");
      expect(re.test(SQL)).toBe(false);
    }
  });

  it("performs no function body / signature changes (privilege change only)", () => {
    expect(/CREATE\s+OR\s+REPLACE\s+FUNCTION/i.test(SQL)).toBe(false);
    expect(/ALTER\s+FUNCTION/i.test(SQL)).toBe(false);
    expect(/DROP\s+FUNCTION/i.test(SQL)).toBe(false);
  });

  it("does not use REVOKE ... IF EXISTS (unsupported for function privileges)", () => {
    expect(/REVOKE\s+[^;]*\bIF\s+EXISTS\b/i.test(SQL)).toBe(false);
  });

  it("does not touch the six-entry anonymous allowlist from the prior hardening pass", () => {
    for (const anonFn of SECDEF_ANON_ALLOWLIST) {
      const re = new RegExp(
        `^\\s*(REVOKE|GRANT)[^\\n]*\\b${anonFn}\\s*\\(`,
        "m",
      );
      expect(re.test(SQL)).toBe(false);
    }
  });

  it("forbids caller-supplied audit actors by removing authenticated access to log_sensitive_data_access", () => {
    expect(
      /REVOKE EXECUTE ON FUNCTION public\.log_sensitive_data_access\(uuid, text, uuid, text\[\]\) FROM authenticated;/.test(
        SQL,
      ),
    ).toBe(true);
  });

  it("aggregates the drafted SQL under a single exported object with correct exclusions", () => {
    expect(LEGACY_SECDEF_AUTHORIZATION.sql).toBe(SQL);
    expect(LEGACY_SECDEF_AUTHORIZATION.migration.applied).toBe(false);
    expect([...LEGACY_SECDEF_AUTHORIZATION.alreadyServiceRoleOnly]).toEqual([
      "public.execute_response_action(uuid, text, jsonb, jsonb)",
      "public.trigger_automated_response(text, text, jsonb)",
      "public.admin_delete_user_data(uuid, uuid)",
    ]);
  });
});
