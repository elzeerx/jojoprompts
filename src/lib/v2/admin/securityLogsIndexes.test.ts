import { describe, expect, it } from "bun:test";
import {
  SECURITY_LOGS_EXISTING_INDEXES,
  SECURITY_LOGS_INDEX_PLAN,
  SECURITY_LOGS_INDEXES_MIGRATION,
  SECURITY_LOGS_INDEXES_SQL,
  SECURITY_LOGS_PLANNED_INDEXES,
} from "./securityLogsIndexes.sql";

const SQL = SECURITY_LOGS_INDEXES_SQL;

describe("security_logs admin query index plan — drafted migration", () => {
  it("is marked drafted and NOT applied live", () => {
    expect(SECURITY_LOGS_INDEXES_MIGRATION.applied).toBe(false);
    expect(SECURITY_LOGS_INDEXES_MIGRATION.drafted).toBe(true);
    expect(SECURITY_LOGS_INDEXES_MIGRATION.filename).toBe(
      "20260728123000_security_logs_admin_query_indexes.sql",
    );
  });

  it("plans exactly three targeted indexes", () => {
    expect(SECURITY_LOGS_PLANNED_INDEXES.length).toBe(3);
    const names = SECURITY_LOGS_PLANNED_INDEXES.map((i) => i.name).sort();
    expect(names).toEqual([
      "idx_security_logs_action",
      "idx_security_logs_actionable_created_at",
      "idx_security_logs_created_at_desc",
    ]);
  });

  it("uses CREATE INDEX IF NOT EXISTS for every planned index (idempotent)", () => {
    for (const idx of SECURITY_LOGS_PLANNED_INDEXES) {
      expect(idx.definition.startsWith("CREATE INDEX IF NOT EXISTS ")).toBe(
        true,
      );
      expect(SQL.includes(`${idx.definition};`)).toBe(true);
    }
  });

  it("does not duplicate the existing severity/category single-column indexes", () => {
    for (const existing of SECURITY_LOGS_EXISTING_INDEXES) {
      expect(SQL.includes(existing)).toBe(false);
    }
    // Also: no new severity/category-rooted composite that would shadow them.
    expect(/\(\s*severity\b/.test(SQL)).toBe(false);
    expect(/\(\s*event_category\b/.test(SQL)).toBe(false);
  });

  it("orders the created_at indexes DESC to match ORDER BY created_at DESC LIMIT", () => {
    const created = SECURITY_LOGS_PLANNED_INDEXES.filter((i) =>
      i.name.includes("created_at"),
    );
    expect(created.length).toBe(2);
    for (const i of created) {
      expect(i.definition.includes("(created_at DESC)")).toBe(true);
    }
  });

  it("restricts the actionable partial index to the exact noise-exclusion list", () => {
    const partial = SECURITY_LOGS_PLANNED_INDEXES.find(
      (i) => i.name === "idx_security_logs_actionable_created_at",
    );
    expect(partial).toBeDefined();
    expect(
      partial!.definition.includes(
        "WHERE action NOT IN ('route_access','developer_tools_opened')",
      ),
    ).toBe(true);
  });

  it("performs privilege- and schema-safe changes only (no ALTER/DROP/GRANT)", () => {
    expect(/DROP\s+INDEX/i.test(SQL)).toBe(false);
    expect(/ALTER\s+TABLE/i.test(SQL)).toBe(false);
    expect(/GRANT\b/i.test(SQL)).toBe(false);
    expect(/REVOKE\b/i.test(SQL)).toBe(false);
    // Never CONCURRENTLY — cannot run inside a migration transaction.
    expect(/CONCURRENTLY/i.test(SQL)).toBe(false);
  });

  it("aggregates the plan under a single exported object", () => {
    expect(SECURITY_LOGS_INDEX_PLAN.sql).toBe(SQL);
    expect(SECURITY_LOGS_INDEX_PLAN.indexes.length).toBe(3);
    expect(SECURITY_LOGS_INDEX_PLAN.migration.applied).toBe(false);
  });
});
