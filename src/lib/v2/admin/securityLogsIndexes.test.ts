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

// Read the physical migration at test time. Bun resolves this via node:fs.
declare const require: (m: string) => any;
declare const process: { cwd(): string };
const { readFileSync } = require("fs");
const { resolve } = require("path");

const PHYSICAL_PATH = resolve(
  process.cwd(),
  SECURITY_LOGS_INDEXES_MIGRATION.migrationPath,
);

const PHYSICAL_SQL: string = readFileSync(PHYSICAL_PATH, "utf8");
const SQL = SECURITY_LOGS_INDEXES_SQL;

/** Normalize whitespace so trailing-newline / CRLF diffs never fail parity. */
const normalize = (s: string) => s.replace(/\r\n/g, "\n").trimEnd();

describe("security_logs admin query-support migration — physical file", () => {
  it("physical migration exists at the expected path", () => {
    expect(PHYSICAL_SQL.length).toBeGreaterThan(0);
    expect(SECURITY_LOGS_INDEXES_MIGRATION.migrationPath).toBe(
      "supabase/migrations/20260728123000_security_logs_admin_query_support.sql",
    );
    expect(SECURITY_LOGS_INDEXES_MIGRATION.filename).toBe(
      "20260728123000_security_logs_admin_query_support.sql",
    );
  });

  it("physical SQL matches the embedded TS fixture (normalized equality)", () => {
    expect(normalize(PHYSICAL_SQL)).toBe(normalize(SQL));
  });

  it("is marked applied live with the recorded Supabase migration version", () => {
    expect(SECURITY_LOGS_INDEXES_MIGRATION.applied).toBe(true);
    expect(SECURITY_LOGS_INDEXES_MIGRATION.drafted).toBe(false);
    expect(SECURITY_LOGS_INDEXES_MIGRATION.liveVersion).toBe("20260728101447");
  });


describe("security_logs admin query index plan — drafted migration", () => {
  it("plans exactly three targeted indexes with the required names", () => {
    expect(SECURITY_LOGS_PLANNED_INDEXES.length).toBe(3);
    const names = SECURITY_LOGS_PLANNED_INDEXES.map((i) => i.name).sort();
    expect(names).toEqual([
      "idx_security_logs_action_created_at_desc",
      "idx_security_logs_actionable_created_at",
      "idx_security_logs_created_at_desc",
    ]);
  });

  it("does NOT introduce the action-only index (superseded by the composite)", () => {
    for (const s of [SQL, PHYSICAL_SQL]) {
      // Reject `idx_security_logs_action ` (space) and `idx_security_logs_action(` variants
      // without matching the composite name that starts with the same prefix.
      expect(
        /idx_security_logs_action(?![_a-z0-9])/i.test(s),
      ).toBe(false);
    }
  });

  it("action drill-down uses a (action, created_at DESC) composite", () => {
    const composite = SECURITY_LOGS_PLANNED_INDEXES.find(
      (i) => i.name === "idx_security_logs_action_created_at_desc",
    );
    expect(composite === undefined).toBe(false);
    expect(composite!.definition.includes("(action, created_at DESC)")).toBe(
      true,
    );
    for (const s of [SQL, PHYSICAL_SQL]) {
      expect(s.includes("(action, created_at DESC)")).toBe(true);
    }
  });

  it("uses CREATE INDEX IF NOT EXISTS for every planned index (idempotent)", () => {
    for (const idx of SECURITY_LOGS_PLANNED_INDEXES) {
      expect(idx.definition.startsWith("CREATE INDEX IF NOT EXISTS ")).toBe(
        true,
      );
      for (const s of [SQL, PHYSICAL_SQL]) {
        expect(s.includes(`${idx.definition};`)).toBe(true);
      }
    }
  });

  it("does not duplicate the existing severity/category single-column indexes", () => {
    for (const s of [SQL, PHYSICAL_SQL]) {
      for (const existing of SECURITY_LOGS_EXISTING_INDEXES) {
        expect(s.includes(existing)).toBe(false);
      }
      // No new severity/category-rooted composite that would shadow them.
      expect(/\(\s*severity\b/.test(s)).toBe(false);
      expect(/\(\s*event_category\b/.test(s)).toBe(false);
    }
  });

  it("orders the created_at indexes DESC to match ORDER BY created_at DESC LIMIT", () => {
    const created = SECURITY_LOGS_PLANNED_INDEXES.filter((i) =>
      /created_at/.test(i.name),
    );
    // I1 + I2 + I3 all end in `created_at DESC` (composite trailing key).
    expect(created.length).toBe(3);
    for (const i of created) {
      expect(/created_at DESC\)/.test(i.definition)).toBe(true);
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

  it("performs privilege- and schema-safe changes only (no ALTER/DROP/GRANT/CONCURRENTLY)", () => {
    for (const s of [SQL, PHYSICAL_SQL]) {
      expect(/DROP\s+INDEX/i.test(s)).toBe(false);
      expect(/ALTER\s+TABLE/i.test(s)).toBe(false);
      expect(/GRANT\b/i.test(s)).toBe(false);
      expect(/REVOKE\b/i.test(s)).toBe(false);
      expect(/CONCURRENTLY/i.test(s)).toBe(false);
    }
  });

  it("aggregates the plan under a single exported object", () => {
    expect(SECURITY_LOGS_INDEX_PLAN.sql).toBe(SQL);
    expect(SECURITY_LOGS_INDEX_PLAN.indexes.length).toBe(3);
    expect(SECURITY_LOGS_INDEX_PLAN.migration.applied).toBe(false);
  });
});

describe("security_logs legacy severity normalization — drafted UPDATE", () => {
  const NORM = SECURITY_LOGS_LEGACY_SEVERITY_NORMALIZATION_SQL;

  it("has exactly one bounded UPDATE statement in the migration", () => {
    for (const s of [SQL, PHYSICAL_SQL]) {
      const updates = s.match(/\bUPDATE\s+public\.security_logs\b/gi) ?? [];
      expect(updates.length).toBe(1);
    }
  });

  it("documents the exact expected affected-row count from live evidence (117)", () => {
    expect(SECURITY_LOGS_LEGACY_SEVERITY_EXPECTED_AFFECTED).toBe(117);
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

  it("guards the UPDATE to top-level severity = 'info' only", () => {
    expect(/WHERE\s+severity\s*=\s*'info'/i.test(NORM)).toBe(true);
    const updateBlock = NORM.match(/UPDATE[\s\S]+?;/)![0];
    expect(/severity\s*=\s*'info'/i.test(updateBlock)).toBe(true);
    expect(/IN\s*\('medium','high','critical'\)/i.test(updateBlock)).toBe(true);
  });

  it("does not backfill or otherwise touch event_category", () => {
    for (const s of [NORM, SQL, PHYSICAL_SQL]) {
      // event_category may not appear in the UPDATE/index bodies.
      const updateBlock = s.match(/UPDATE[\s\S]+?;/);
      if (updateBlock) {
        expect(/event_category/i.test(updateBlock[0])).toBe(false);
      }
    }
  });

  it("is idempotent by predicate shape", () => {
    expect(
      /UPDATE\s+public\.security_logs\s+SET\s+severity\s*=\s*details->>'severity'/i.test(
        NORM,
      ),
    ).toBe(true);
    expect(
      /WHERE\s+severity\s*=\s*'info'\s+AND\s+details->>'severity'\s+IN/i.test(
        NORM,
      ),
    ).toBe(true);
  });

  it("does not reintroduce JSON severity into query paths (no index on details, no ORDER BY on JSON)", () => {
    for (const s of [SQL, PHYSICAL_SQL]) {
      expect(/CREATE\s+INDEX[^;]*details/i.test(s)).toBe(false);
      expect(/ORDER\s+BY[^;]*details->>'severity'/i.test(s)).toBe(false);
    }
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
