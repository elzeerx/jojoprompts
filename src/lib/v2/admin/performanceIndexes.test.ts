import { describe, it, expect } from "bun:test";
import {
  TARGETED_FK_INDEXES,
  V2_FK_INDEXES,
  V2_FK_INDEXES_APPLIED_LIVE,
  V2_FK_INDEXES_MIGRATION_FILENAME,
  V2_FK_INDEXES_REMAINING,
  V2_FK_INDEXES_REMAINING_MIGRATION_FILENAME,
  V2_FK_INDEXES_REMAINING_SQL,
  V2_FK_INDEXES_SQL,
} from "./performanceIndexes.sql";

describe("V2 FK index fixture — applied-source record", () => {
  it("names the first applied migration correctly", () => {
    expect(V2_FK_INDEXES_MIGRATION_FILENAME).toBe(
      "20260727140438_add_v2_foreign_key_indexes.sql",
    );
    expect(V2_FK_INDEXES.filename).toBe(V2_FK_INDEXES_MIGRATION_FILENAME);
    expect(V2_FK_INDEXES.applied).toBe(true);
  });

  it("preserves the exactTimestampPending marker for the second migration", () => {
    expect(V2_FK_INDEXES_REMAINING_MIGRATION_FILENAME).toBe(
      "2026072714xx_add_remaining_v2_foreign_key_indexes.sql",
    );
    expect(V2_FK_INDEXES_REMAINING.filename).toBe(
      V2_FK_INDEXES_REMAINING_MIGRATION_FILENAME,
    );
    expect(V2_FK_INDEXES_REMAINING.applied).toBe(true);
    expect(V2_FK_INDEXES_REMAINING.exactTimestampPending).toBe(true);
    // The placeholder minute/second segment must be preserved verbatim.
    expect(/2026072714xx/.test(V2_FK_INDEXES_REMAINING_MIGRATION_FILENAME)).toBe(true);
  });

  it("records both migrations in APPLIED_LIVE with the expected names", () => {
    const names = V2_FK_INDEXES_APPLIED_LIVE.map((m) => m.name);
    expect(names).toEqual([
      "add_v2_foreign_key_indexes",
      "add_remaining_v2_foreign_key_indexes",
    ]);
    for (const m of V2_FK_INDEXES_APPLIED_LIVE) {
      expect(m.applied).toBe(true);
    }
  });

  it("covers exactly the ten first-pass FK columns", () => {
    const pairs = TARGETED_FK_INDEXES
      .filter((i) => i.migration === "add_v2_foreign_key_indexes")
      .map((i) => `${i.table}.${i.column}`)
      .sort();
    expect(pairs).toEqual(
      [
        "cart_items.product_id",
        "entitlements.resource_id",
        "order_items.product_id",
        "order_items.resource_id",
        "order_items.resource_version_id",
        "orders.legacy_transaction_id",
        "package_scan_items.resource_file_id",
        "package_scans.requested_by",
        "product_bundle_items.resource_id",
        "resources.current_version_id",
      ].sort(),
    );
  });

  it("covers exactly the five remaining FK columns", () => {
    const pairs = TARGETED_FK_INDEXES
      .filter((i) => i.migration === "add_remaining_v2_foreign_key_indexes")
      .map((i) => `${i.table}.${i.column}`)
      .sort();
    expect(pairs).toEqual(
      [
        "user_roles.assigned_by",
        "v2_discount_codes.archived_by",
        "v2_discount_codes.created_by",
        "v2_discount_codes.updated_by",
        "v2_discount_redemptions.user_id",
      ].sort(),
    );
  });

  it("has no duplicate index names across both migrations", () => {
    const names = TARGETED_FK_INDEXES.map((i) => i.index);
    expect(names.length).toBe(15);
    expect(new Set(names).size).toBe(names.length);
  });

  it("uses idempotent CREATE INDEX IF NOT EXISTS everywhere", () => {
    for (const sql of [V2_FK_INDEXES_SQL, V2_FK_INDEXES_REMAINING_SQL]) {
      const creates = sql.match(/CREATE INDEX[^\n]*/g) ?? [];
      expect(creates.length).toBeGreaterThan(0);
      for (const line of creates) {
        expect(/CREATE INDEX IF NOT EXISTS/.test(line)).toBe(true);
      }
    }
  });

  it("does not include DROP, RLS, grant, or data statements", () => {
    for (const sql of [V2_FK_INDEXES_SQL, V2_FK_INDEXES_REMAINING_SQL]) {
      for (const forbidden of [
        /DROP\s+INDEX/i,
        /DROP\s+TABLE/i,
        /ALTER TABLE/i,
        /GRANT\s+/i,
        /REVOKE\s+/i,
        /ENABLE ROW LEVEL SECURITY/i,
        /DISABLE ROW LEVEL SECURITY/i,
        /INSERT\s+INTO/i,
        /UPDATE\s+public\./i,
        /DELETE\s+FROM/i,
      ]) {
        expect(forbidden.test(sql)).toBe(false);
      }
    }
  });

  it("emits every targeted column exactly once in its migration SQL", () => {
    for (const t of TARGETED_FK_INDEXES) {
      const sql =
        t.migration === "add_v2_foreign_key_indexes"
          ? V2_FK_INDEXES_SQL
          : V2_FK_INDEXES_REMAINING_SQL;
      const line = `CREATE INDEX IF NOT EXISTS ${t.index} ON public.${t.table}(${t.column});`;
      expect(sql.includes(line)).toBe(true);
    }
  });
});
