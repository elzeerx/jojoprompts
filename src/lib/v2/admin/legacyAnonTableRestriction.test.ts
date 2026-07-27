import { describe, it, expect } from "bun:test";
import {
  LEGACY_ANON_PRESERVED_TABLES,
  LEGACY_ANON_RESTRICTED_TABLES,
  LEGACY_ANON_RESTRICTION_MIGRATION,
  LEGACY_ANON_RESTRICTION_SQL,
  LEGACY_ANON_TABLE_RESTRICTION as F,
} from "./legacyAnonTableRestriction.sql";

describe("legacy anon-table restriction — source fixture", () => {
  it("records the exact applied migration filename and applied-live metadata", () => {
    expect(LEGACY_ANON_RESTRICTION_MIGRATION.applied).toBe(true);
    expect(LEGACY_ANON_RESTRICTION_MIGRATION.authoritative).toBe(true);
    expect(LEGACY_ANON_RESTRICTION_MIGRATION.version).toBe("20260727142841");
    expect(LEGACY_ANON_RESTRICTION_MIGRATION.name).toBe(
      "restrict_legacy_anon_table_surface",
    );
    expect(LEGACY_ANON_RESTRICTION_MIGRATION.filename).toBe(
      "20260727142841_restrict_legacy_anon_table_surface.sql",
    );
  });

  it("restricts exactly the five specified tables (content-exact)", () => {
    const expected = [
      "collection_prompts",
      "collections",
      "prompt_generator_templates",
      "prompt_templates",
      "subscription_plans",
    ].sort();
    expect([...LEGACY_ANON_RESTRICTED_TABLES].sort()).toEqual(expected);
    expect(LEGACY_ANON_RESTRICTED_TABLES.length).toBe(5);
  });

  it("preserves exactly the eleven intentional anon-visible V2 tables", () => {
    const expected = [
      "categories",
      "installation_guides",
      "licenses",
      "platform_compatibility",
      "platform_fields",
      "platforms",
      "product_bundle_items",
      "products",
      "resource_permissions",
      "resource_versions",
      "resources",
    ].sort();
    expect([...LEGACY_ANON_PRESERVED_TABLES].sort()).toEqual(expected);
    expect(LEGACY_ANON_PRESERVED_TABLES.length).toBe(11);
  });

  it("restricted and preserved sets are disjoint", () => {
    for (const t of LEGACY_ANON_RESTRICTED_TABLES) {
      expect(LEGACY_ANON_PRESERVED_TABLES.includes(t as never)).toBe(false);
    }
  });

  it("emits exactly one REVOKE ALL PRIVILEGES ... FROM anon per restricted table", () => {
    expect(LEGACY_ANON_RESTRICTION_SQL.length).toBe(5);
    for (const table of LEGACY_ANON_RESTRICTED_TABLES) {
      const expected = `REVOKE ALL PRIVILEGES ON TABLE public.${table} FROM anon;`;
      expect(LEGACY_ANON_RESTRICTION_SQL.includes(expected)).toBe(true);
    }
    for (const stmt of LEGACY_ANON_RESTRICTION_SQL) {
      expect(stmt.startsWith("REVOKE ALL PRIVILEGES ON TABLE public.")).toBe(
        true,
      );
      expect(stmt.endsWith("FROM anon;")).toBe(true);
    }
  });

  it("never revokes from authenticated or service_role", () => {
    for (const stmt of LEGACY_ANON_RESTRICTION_SQL) {
      expect(stmt).not.toMatch(/FROM\s+authenticated/i);
      expect(stmt).not.toMatch(/FROM\s+service_role/i);
      expect(stmt).not.toMatch(/FROM\s+PUBLIC/i);
    }
    expect(F.guarantees.authenticatedUnchanged).toBe(true);
    expect(F.guarantees.serviceRoleUnchanged).toBe(true);
  });

  it("performs no policy DDL and no data or structural mutation", () => {
    for (const stmt of LEGACY_ANON_RESTRICTION_SQL) {
      expect(stmt).not.toMatch(/\b(CREATE|DROP|ALTER)\s+POLICY\b/i);
      expect(stmt).not.toMatch(/\bALTER\s+TABLE\b/i);
      expect(stmt).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
      expect(stmt).not.toMatch(/\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i);
    }
    expect(F.guarantees.rlsPoliciesUnchanged).toBe(true);
    expect(F.guarantees.noDataMutation).toBe(true);
    expect(F.guarantees.noStructuralChange).toBe(true);
  });

  it("does not touch storage.*, functions, or unrelated tables", () => {
    const forbidden = [
      "storage.",
      "auth.",
      "FUNCTION",
      "orders",
      "entitlements",
      "cart_items",
      "profiles",
      "user_roles",
      "security_logs",
      "activity_events",
      "payment_events",
    ];
    for (const stmt of LEGACY_ANON_RESTRICTION_SQL) {
      for (const term of forbidden) {
        expect(stmt.toLowerCase()).not.toContain(term.toLowerCase());
      }
    }
  });
});
