import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260729171000_reconcile_missing_auth_profiles.sql",
  "utf8",
);
const executableSql = migration.replace(/^--.*$/gm, "");

describe("missing Auth profile reconciliation migration", () => {
  it("selects missing profiles generically without hard-coded user ids", () => {
    expect(migration).toContain("LEFT JOIN public.profiles p ON p.id = au.id");
    expect(migration).toContain("WHERE p.id IS NULL");
    expect(migration).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it("is idempotent for profile and role inserts", () => {
    expect(migration).toContain("ON CONFLICT (id) DO NOTHING");
    expect(migration).toContain(
      "ON CONFLICT (user_id, role) DO NOTHING",
    );
  });

  it("preserves existing roles and grants only the ordinary user role when absent", () => {
    expect(migration).toMatch(
      /IF NOT EXISTS \([\s\S]*?public\.user_roles[\s\S]*?WHERE ur\.user_id = v_user\.id[\s\S]*?THEN/,
    );
    expect(migration).toContain("'user'");
    expect(migration).toContain("false");
    expect(migration).not.toMatch(/'admin'|'jadmin'/);
  });

  it("does not mutate commerce, entitlements, or lifetime credit", () => {
    expect(executableSql).not.toMatch(
      /\b(?:orders|order_items|payment_events|refunds|entitlements|lifetime_credit_entries)\b/i,
    );
  });

  it("fails the migration if any profile or role gap remains", () => {
    expect(migration).toContain("auth_profile_reconciliation_incomplete");
    expect(migration).toContain("profile_role_reconciliation_incomplete");
  });
});
