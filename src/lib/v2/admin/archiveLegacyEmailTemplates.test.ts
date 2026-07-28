/**
 * Contract for the source-only archive_legacy_email_templates fixture.
 *
 * The fixture must:
 *   - Target exactly the seven audited slugs and no others.
 *   - Be idempotent (UPDATE-only, guarded).
 *   - Contain NO destructive DDL/DML (DELETE / DROP / TRUNCATE).
 *   - Ship a reversible rollback that restores is_active = true.
 *   - Not be marked as applied live.
 */
import { describe, it, expect } from "bun:test";
import {
  LEGACY_ARCHIVE_SLUGS,
  archiveLegacyEmailTemplatesSql,
  rollbackSql,
  metadata,
} from "./archiveLegacyEmailTemplates.sql";

const EXPECTED_SLUGS = [
  "email_confirmation",
  "marketing_general",
  "password_reset",
  "payment_confirmation",
  "plan_reminder",
  "plan_selection_nudge",
  "welcome",
];

describe("archive_legacy_email_templates fixture", () => {
  it("targets exactly the seven audited slugs (order-independent)", () => {
    expect([...LEGACY_ARCHIVE_SLUGS].sort()).toEqual([...EXPECTED_SLUGS].sort());
    expect(LEGACY_ARCHIVE_SLUGS.length).toBe(7);
  });

  it("forward SQL touches only email_templates and sets is_active = false", () => {
    expect(/UPDATE\s+public\.email_templates/i.test(archiveLegacyEmailTemplatesSql)).toBe(true);
    expect(/SET\s+is_active\s*=\s*false/i.test(archiveLegacyEmailTemplatesSql)).toBe(true);
    // Only one table referenced.
    const tables = archiveLegacyEmailTemplatesSql.match(/\bpublic\.(\w+)/g) ?? [];
    for (const t of tables) expect(t).toBe("public.email_templates");
    // Every named slug is one of the seven; no stray extras.
    for (const s of EXPECTED_SLUGS) {
      expect(archiveLegacyEmailTemplatesSql.includes(`'${s}'`)).toBe(true);
    }
    const quoted = archiveLegacyEmailTemplatesSql.match(/'([a-z_]+)'/g) ?? [];
    for (const q of quoted) {
      const slug = q.slice(1, -1);
      expect(EXPECTED_SLUGS.includes(slug)).toBe(true);
    }
  });

  it("forward SQL is idempotent (guarded by is_active = true)", () => {
    expect(/AND\s+is_active\s*=\s*true/i.test(archiveLegacyEmailTemplatesSql)).toBe(true);
  });

  it("contains NO destructive statements", () => {
    for (const sql of [archiveLegacyEmailTemplatesSql, rollbackSql]) {
      expect(/\bDELETE\b/i.test(sql)).toBe(false);
      expect(/\bDROP\b/i.test(sql)).toBe(false);
      expect(/\bTRUNCATE\b/i.test(sql)).toBe(false);
      expect(/\bALTER\b/i.test(sql)).toBe(false);
    }
  });

  it("rollback restores is_active = true for the exact same slug set", () => {
    expect(/UPDATE\s+public\.email_templates/i.test(rollbackSql)).toBe(true);
    expect(/SET\s+is_active\s*=\s*true/i.test(rollbackSql)).toBe(true);
    for (const s of EXPECTED_SLUGS) {
      expect(rollbackSql.includes(`'${s}'`)).toBe(true);
    }
  });

  it("metadata records the fixture as NOT applied live and reversible", () => {
    expect(metadata.appliedLive).toBe(false);
    expect(metadata.idempotent).toBe(true);
    expect(metadata.containsDelete).toBe(false);
    expect(metadata.reversible).toBe(true);
    expect(metadata.intendedMigrationName).toBe("archive_legacy_email_templates");
  });
});
