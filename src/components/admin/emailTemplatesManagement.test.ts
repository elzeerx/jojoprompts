/**
 * V2 Transactional Templates admin contract.
 *
 * Locks the outcome of the completed audit:
 *  - Route h1 remains "Transactional Templates".
 *  - Page exposes a code-managed "Active system emails" section and a
 *    reversible "Legacy template archive" section.
 *  - No hard Delete, no New/Edit/Test on legacy rows.
 *  - No subscription/plan terminology in the active surface (legacy rows in
 *    the archive may keep their historical slugs).
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;

function read(rel: string): string {
  const fs = require("fs") as { readFileSync(p: string, enc: string): string };
  return fs.readFileSync(rel, "utf8");
}

const PAGE = read("src/components/admin/EmailTemplatesManagement.tsx");

// Strip comments so string checks don't hit doc prose.
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("Transactional Templates admin surface", () => {
  it("keeps the exact route h1", () => {
    expect(/<h1[^>]*>Transactional Templates<\/h1>/.test(CODE)).toBe(true);
    expect((CODE.match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });

  it("declares an Active system emails section listing the four real sources", () => {
    expect(/Active system emails/.test(CODE)).toBe(true);
    expect(/V2 delivery/.test(CODE)).toBe(true);
    expect(/Application code/.test(CODE)).toBe(true);
    expect(/Supabase Auth/.test(CODE)).toBe(true);
    // Exactly four canonical surfaces enumerated in ACTIVE_SYSTEM_EMAILS.
    const entries = CODE.match(/key:\s*"[^"]+"/g) ?? [];
    expect(entries.length).toBe(4);
  });

  it("declares a reversible Legacy template archive section", () => {
    expect(/Legacy template archive/.test(CODE)).toBe(true);
    expect(/Archive/.test(CODE)).toBe(true);
    expect(/Restore/.test(CODE)).toBe(true);
  });

  it("removes hard Delete + New/Edit/Test-send affordances", () => {
    expect(/from\("email_templates"\)\s*\.delete\(\)/.test(CODE)).toBe(false);
    expect(/functions\.invoke\("send-email"/.test(CODE)).toBe(false);
    expect(/openCreate|openEdit|openSendTest|sendTest/.test(CODE)).toBe(false);
    expect(/>New</.test(CODE)).toBe(false);
    expect(/>Edit</.test(CODE)).toBe(false);
    expect(/>Test</.test(CODE)).toBe(false);
    expect(/>Delete</.test(CODE)).toBe(false);
  });

  it("only mutates is_active on email_templates", () => {
    // Any update against email_templates must set is_active only.
    const updates = CODE.match(/from\("email_templates"\)\s*\.update\([^)]*\)/g) ?? [];
    expect(updates.length).toBeGreaterThan(0);
    for (const u of updates) {
      expect(/is_active/.test(u)).toBe(true);
      expect(/subject|html|text|variables|name\s*:/.test(u)).toBe(false);
    }
  });

  it("writes an admin_audit_log entry for Archive/Restore", () => {
    expect(/admin_audit_log/.test(CODE)).toBe(true);
    expect(/email_template_archive/.test(CODE)).toBe(true);
    expect(/email_template_restore/.test(CODE)).toBe(true);
  });

  it("removes subscription/plan terminology from the active surface", () => {
    // "plan_reminder" / "plan_selection_nudge" are legacy DB slugs and MUST
    // NOT be hard-coded into the active-surface labels or copy. They only
    // appear (if at all) as dynamic row data inside the archive table.
    expect(/plan_reminder|plan_selection_nudge|subscription/i.test(CODE)).toBe(
      false,
    );
  });
});
