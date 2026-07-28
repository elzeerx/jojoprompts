import { describe, expect, it } from "bun:test";
import {
  SECURITY_LOGS_EXISTING_INDEXES,
  SECURITY_LOGS_INDEX_PLAN,
  SECURITY_LOGS_INDEXES_MIGRATION,
  SECURITY_LOGS_INDEXES_SQL,
  SECURITY_LOGS_LEGACY_SEVERITY_ALLOWLIST,
  SECURITY_LOGS_LEGACY_SEVERITY_EXPECTED_AFFECTED,
  SECURITY_LOGS_LEGACY_SEVERITY_NORMALIZATION_SQL,
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
    expect(partial === undefined).toBe(false);
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

describe("security_logs legacy severity normalization — drafted UPDATE", () => {
  const NORM = SECURITY_LOGS_LEGACY_SEVERITY_NORMALIZATION_SQL;

  it("documents the exact expected affected-row count from live evidence (117)", () => {
    expect(SECURITY_LOGS_LEGACY_SEVERITY_EXPECTED_AFFECTED).toBe(117);
    // Documented but not enforced as a hard failure — must appear in SQL comment.
    expect(NORM.includes("Expected at draft time: 117")).toBe(true);
  });

  it("uses an explicit allowlist of stronger severity values", () => {
    expect([...SECURITY_LOGS_LEGACY_SEVERITY_ALLOWLIST]).toEqual([
      "medium",
      "high",
      "critical",
    ]);
    expect(
      NORM.includes("details->>'severity' IN ('medium','high','critical')"),
    ).toBe(true);
  });

  it("guards the UPDATE to top-level severity = 'info' only (never overwrites stronger authoritative values)", () => {
    // The WHERE clause must include severity = 'info'.
    expect(/WHERE\s+severity\s*=\s*'info'/i.test(NORM)).toBe(true);
    // And the UPDATE must not blindly copy from details without the guard.
    const updateBlock = NORM.match(/UPDATE[\s\S]+?;/)![0];
    expect(/severity\s*=\s*'info'/i.test(updateBlock)).toBe(true);
    expect(/IN\s*\('medium','high','critical'\)/i.test(updateBlock)).toBe(true);
  });

  it("does not backfill or otherwise touch event_category", () => {
    expect(/event_category/i.test(NORM)).toBe(false);
  });

  it("is idempotent: after apply, no matching row remains", () => {
    // The WHERE predicate becomes vacuous once severity is promoted off 'info',
    // so a re-run affects zero rows. Assert the predicate structure that gives us this.
    expect(/UPDATE\s+public\.security_logs\s+SET\s+severity\s*=\s*details->>'severity'/i.test(NORM)).toBe(true);
    expect(/WHERE\s+severity\s*=\s*'info'\s+AND\s+details->>'severity'\s+IN/i.test(NORM)).toBe(true);
  });

  it("does not use raw JSON severity in application query paths (comment/preflight only)", () => {
    // The normalization SQL may reference details->>'severity' for the one-time backfill,
    // but no CREATE INDEX or ORDER BY / filter on details->>'severity' is introduced.
    expect(/CREATE\s+INDEX[^;]*details/i.test(SQL)).toBe(false);
    expect(/ORDER\s+BY[^;]*details->>'severity'/i.test(SQL)).toBe(false);
  });

  it("is included in the combined migration SQL and plan export", () => {
    expect(SQL.includes(NORM)).toBe(true);
    expect(SECURITY_LOGS_INDEX_PLAN.legacySeverityNormalizationSql).toBe(NORM);
    expect(SECURITY_LOGS_INDEX_PLAN.legacySeverityExpectedAffected).toBe(117);
    expect([...SECURITY_LOGS_INDEX_PLAN.legacySeverityAllowlist]).toEqual([
      "medium",
      "high",
      "critical",
    ]);
  });
});
