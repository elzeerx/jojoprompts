import { describe, it, expect } from "bun:test";
import {
  TARGETED_FK_INDEXES,
  V2_FK_INDEXES,
  V2_FK_INDEXES_MIGRATION_FILENAME,
  V2_FK_INDEXES_SQL as SQL,
} from "./performanceIndexes.sql";

describe("V2 FK index fixture", () => {
  it("targets the intended migration filename", () => {
    expect(V2_FK_INDEXES_MIGRATION_FILENAME).toBe(
      "20260728020000_v2_fk_indexes.sql",
    );
    expect(V2_FK_INDEXES.filename).toBe(V2_FK_INDEXES_MIGRATION_FILENAME);
  });

  it("declares exactly the ten targeted FK indexes and no duplicates", () => {
    const names = TARGETED_FK_INDEXES.map((i) => i.index);
    expect(names.length).toBe(10);
    expect(new Set(names).size).toBe(names.length);

    // Every target column is present in the SQL.
    for (const t of TARGETED_FK_INDEXES) {
      const line = `CREATE INDEX IF NOT EXISTS ${t.index} ON public.${t.table}(${t.column});`;
      expect(SQL.includes(line)).toBe(true);
    }
  });

  it("uses idempotent CREATE INDEX IF NOT EXISTS everywhere", () => {
    const creates = SQL.match(/CREATE INDEX[^\n]*/g) ?? [];
    expect(creates.length).toBe(10);
    for (const line of creates) {
      expect(/CREATE INDEX IF NOT EXISTS/.test(line)).toBe(true);
    }
  });

  it("does not include DROP, RLS, grant, or data statements", () => {
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
      expect(forbidden.test(SQL)).toBe(false);
    }
  });

  it("covers exactly the ten FK columns listed in the audit brief", () => {
    const pairs = TARGETED_FK_INDEXES.map((i) => `${i.table}.${i.column}`).sort();
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
});
