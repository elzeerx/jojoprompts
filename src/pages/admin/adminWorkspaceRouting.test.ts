import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolveLegacyAdminPath } from "./layout/adminRouteCompatibility";

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
    expect(app).toContain('path="content"');
    expect(app).not.toContain('path="content/*"');
    expect(app).toContain('path="commerce"');
    expect(app).toContain('path="people"');
    expect(app).toContain('path="operations"');
    expect(app).toContain('path="settings"');
    expect(app).not.toMatch(/path="(?:catalog|publishing|orders|users|communications|trust)(?:\/|\")/);
  });

  it("preserves old bookmarks through one compatibility resolver", () => {
    expect(app).toContain('<Route path="*" element={<AdminCompatibilityResolver />} />');
    expect(resolveLegacyAdminPath("catalog/skills")).toBe("/admin/content?type=skill");
    expect(resolveLegacyAdminPath("publishing/review")).toBe("/admin/content?tab=review");
    expect(resolveLegacyAdminPath("orders/refunds")).toBe("/admin/commerce?tab=refunds");
    expect(resolveLegacyAdminPath("communications/templates")).toBe("/admin/operations?tab=templates");
    expect(resolveLegacyAdminPath("trust/scans")).toBe("/admin/operations?tab=scans");
    expect(resolveLegacyAdminPath("settings/roles")).toBe("/admin/people?tab=roles");
    expect(resolveLegacyAdminPath("unknown/deep/path")).toBe("/admin");
  });

  it("maps retired Content sub-pages into query-state on one exact route", () => {
    const id = "766f3370-d38c-42e5-8566-5e4946986dd2";
    expect(resolveLegacyAdminPath(`publishing/resources/${id}/edit`)).toBe(
      `/admin/content?tool=edit&resourceId=${id}`,
    );
    expect(resolveLegacyAdminPath(`publishing/resources/${id}/versions/new`)).toBe(
      `/admin/content?tool=new-version&resourceId=${id}`,
    );
    expect(resolveLegacyAdminPath("publishing/imports/ai-studio/draft-1")).toBe(
      "/admin/content?tool=ai-studio&draftId=draft-1",
    );
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
