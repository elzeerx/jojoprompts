/**
 * Contract: each active admin route surface exposes exactly one semantic <h1>
 * matching the navigation title. Prevents heading regressions after nav rename.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

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
    forbidden: />\s*Audit Log\s*</,
  },
];

describe("admin route h1 headings", () => {
  for (const { file, h1, forbidden } of CASES) {
    it(`${file} exposes exactly one matching <h1>`, () => {
      const src = readFileSync(join(root, file), "utf8");
      const h1Count = (src.match(/<h1[\s>]/g) ?? []).length;
      expect(h1Count).toBe(1);
      expect(src).toMatch(h1);
      if (forbidden) expect(src).not.toMatch(forbidden);
    });
  }
});
