import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const app = readFileSync("src/App.tsx", "utf8");
const nav = readFileSync("src/pages/admin/config/adminNavConfig.ts", "utf8");
const workspace = readFileSync("src/pages/admin/layout/AdminWorkspacePage.tsx", "utf8");

describe("Admin V2 workspace consolidation", () => {
  it("exposes exactly six primary sidebar destinations", () => {
    const primaryRoutes = [
      'to: "/admin"',
      'to: "/admin/content"',
      'to: "/admin/commerce"',
      'to: "/admin/people"',
      'to: "/admin/operations"',
      'to: "/admin/settings"',
    ];
    for (const route of primaryRoutes) expect(nav).toContain(route);
    expect((nav.match(/\bto:\s*"\/admin/g) ?? []).length).toBe(6);
  });

  it("keeps the router limited to five workspace routes plus overview", () => {
    expect(app).toContain('<Route index element={adminSectionElements.overview} />');
    expect(app).toContain('path="content/*"');
    expect(app).toContain('path="commerce"');
    expect(app).toContain('path="people"');
    expect(app).toContain('path="operations"');
    expect(app).toContain('path="settings"');
    expect(app).not.toMatch(/path="(?:catalog|publishing|orders|users|communications|trust)(?:\/|\")/);
  });

  it("preserves old bookmarks through one compatibility resolver", () => {
    expect(app).toContain('<Route path="*" element={<AdminCompatibilityResolver />} />');
    for (const oldPath of [
      '"catalog/skills"',
      '"publishing/review"',
      '"orders/refunds"',
      '"communications/templates"',
      '"trust/scans"',
      '"settings/roles"',
    ]) {
      expect(workspace).toContain(oldPath);
    }
  });

  it("keeps all operational screens reachable as workspace tabs", () => {
    for (const tab of [
      "catalog", "drafts", "review", "versions", "imports", "taxonomy",
      "orders", "payment-events", "entitlements", "refunds", "recovery", "discounts",
      "users", "roles", "templates", "delivery", "reports", "scans",
      "admin-activity", "security-events", "payments", "email", "storage", "integrations",
    ]) {
      expect(workspace).toContain(`id: "${tab}"`);
    }
  });
});
