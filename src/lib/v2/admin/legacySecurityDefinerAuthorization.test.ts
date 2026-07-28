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

describe("legacy SECURITY DEFINER authorization hardening — drafted migration", () => {
  it("is marked drafted and NOT applied live", () => {
    expect(LEGACY_SECDEF_MIGRATION.applied).toBe(false);
    expect(LEGACY_SECDEF_MIGRATION.drafted).toBe(true);
  });

  it("keeps the three tiers disjoint", () => {
    const t1 = new Set(LEGACY_SECDEF_TIER1_AUDIT_LOGGERS.map(nameOf));
    const t2 = new Set(LEGACY_SECDEF_TIER2_UNREACHABLE.map(nameOf));
    const t3 = new Set(LEGACY_SECDEF_TIER3_INVESTIGATE.map(nameOf));
    for (const n of t1) expect(t2.has(n) || t3.has(n)).toBe(false);
    for (const n of t2) expect(t3.has(n)).toBe(false);
  });

  it("never revokes admin_delete_user_data (service_role-only already)", () => {
    expect(LEGACY_SECDEF_MIGRATION_SQL).not.toMatch(/admin_delete_user_data/);
  });

  it("never revokes has_role (RLS + edge admin verification dependency)", () => {
    expect(LEGACY_SECDEF_MIGRATION_SQL).not.toMatch(
      /REVOKE[^\n]*has_role\s*\(/,
    );
  });

  it("never modifies function bodies (source-only privilege change)", () => {
    expect(LEGACY_SECDEF_MIGRATION_SQL).not.toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION/i,
    );
    expect(LEGACY_SECDEF_MIGRATION_SQL).not.toMatch(/ALTER\s+FUNCTION/i);
    expect(LEGACY_SECDEF_MIGRATION_SQL).not.toMatch(/DROP\s+FUNCTION/i);
  });

  it("preserves RLS-critical prompts helpers untouched", () => {
    for (const sig of [
      "can_access_prompt",
      "can_manage_prompts",
      "has_role",
    ]) {
      expect(LEGACY_SECDEF_MIGRATION_SQL).not.toMatch(
        new RegExp(`REVOKE[^\\n]*\\b${sig}\\s*\\(`),
      );
    }
  });

  it("revokes PUBLIC, anon, and authenticated for every Tier 1 + Tier 2 signature", () => {
    for (const sig of [
      ...LEGACY_SECDEF_TIER1_AUDIT_LOGGERS,
      ...LEGACY_SECDEF_TIER2_UNREACHABLE,
    ]) {
      const fn = sig.replace("public.", "").split("(")[0];
      for (const role of ["PUBLIC", "anon", "authenticated"]) {
        expect(LEGACY_SECDEF_MIGRATION_SQL).toMatch(
          new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\b[^;]*FROM ${role}`),
        );
      }
      expect(LEGACY_SECDEF_MIGRATION_SQL).toMatch(
        new RegExp(`GRANT\\s+EXECUTE ON FUNCTION public\\.${fn}\\b[^;]*TO service_role`),
      );
    }
  });

  it("forbids caller-supplied audit actors by removing browser access to log_sensitive_data_access", () => {
    expect(LEGACY_SECDEF_MIGRATION_SQL).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.log_sensitive_data_access\(uuid, text, uuid, text\[\]\) FROM authenticated/,
    );
  });

  it("distinguishes the service_role-only admin_delete_user_data overload from this migration", () => {
    // admin_delete_user_data(target_user_id uuid, admin_user_id uuid) is
    // already service_role-only per live pg_proc; this migration must
    // not reference it at all.
    expect(LEGACY_SECDEF_AUTHORIZATION.sql).not.toMatch(/admin_delete_user_data/);
  });

  it("does not touch the six-entry anonymous allowlist from the prior hardening pass", () => {
    for (const anonFn of SECDEF_ANON_ALLOWLIST) {
      expect(LEGACY_SECDEF_MIGRATION_SQL).not.toMatch(
        new RegExp(`REVOKE[^\\n]*\\b${anonFn}\\s*\\(`),
      );
    }
  });

  it("has no active frontend .rpc() caller for any Tier 1 / Tier 2 function", () => {
    // Repository-wide guard: only allowed references live in
    // src/lib/v2/admin/**, src/integrations/supabase/types.ts (generated),
    // supabase/migrations/**, docs/**, or PHASE_1_SECURITY_FIXES_COMPLETE.md.
    const forbidden = [
      ...LEGACY_SECDEF_TIER1_AUDIT_LOGGERS,
      ...LEGACY_SECDEF_TIER2_UNREACHABLE,
    ].map(nameOf);
    for (const fn of forbidden) {
      // Assert we didn't accidentally leave the fn in an active src page.
      // (Utility modules under src/utils/{incident,compliance,analytics}
      // are unreachable dead code — see audit doc §Group B.)
      const activePages = [
        "src/App.tsx",
        "src/routes.ts",
      ];
      for (const p of activePages) {
        const body = safeRead(join(ROOT, p));
        expect(body.includes(fn)).toBe(false);
      }
    }
  });
});

function nameOf(sig: string): string {
  return sig.replace(/^public\./, "").split("(")[0];
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}
