/**
 * Contract: each active admin route surface exposes exactly one semantic <h1>
 * matching the navigation title. Prevents heading regressions after nav rename.
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;
declare const process: { cwd(): string };

function read(rel: string): string {
  const fs = require("fs") as { readFileSync(p: string, enc: string): string };
  const path = require("path") as { join(...s: string[]): string };
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const CASES: Array<{ file: string; h1: RegExp; forbidden?: RegExp }> = [
  {
    file: "src/pages/admin/components/categories/CategoriesManagement.tsx",
    h1: /<h1[^>]*>Taxonomy<\/h1>/,
    forbidden: /<h2[^>]*>Categories Management<\/h2>/,
  },
  {
    file: "src/pages/admin/sections/orders/DiscountsPage.tsx",
    h1: /<h1[\s\S]*?Discounts[\s\S]*?الخصومات[\s\S]*?<\/h1>/,
  },
  {
    file: "src/components/admin/EmailTemplatesManagement.tsx",
    h1: /<h1[^>]*>Transactional Templates<\/h1>/,
    forbidden: /<h2[^>]*>Email Templates<\/h2>/,
  },
  {
    file: "src/components/admin/SecurityMonitoringDashboard.tsx",
    h1: /<h1[^>]*>Security Events<\/h1>/,
    forbidden: /<h2[^>]*>Security Monitoring<\/h2>/,
  },
  {
    file: "src/pages/admin/sections/system/AuditLogPage.tsx",
    h1: /<h1[\s\S]*?Admin Activity[\s\S]*?<\/h1>/,
  },
];

describe("admin route h1 headings", () => {
  for (const { file, h1, forbidden } of CASES) {
    it(`${file} exposes exactly one matching <h1>`, () => {
      const src = read(file);
      const h1Count = (src.match(/<h1[\s>]/g) ?? []).length;
      expect(h1Count).toBe(1);
      expect(h1.test(src)).toBe(true);
      if (forbidden) expect(forbidden.test(src)).toBe(false);
    });
  }

  it("AuditLogPage no longer titles itself 'Audit Log'", () => {
    const src = read("src/pages/admin/sections/system/AuditLogPage.tsx");
    expect(/<h1[\s\S]*?Audit Log[\s\S]*?<\/h1>/.test(src)).toBe(false);
  });
});
