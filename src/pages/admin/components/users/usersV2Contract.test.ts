/**
 * Contract tests for the V2 /admin/users cleanup:
 *  - no subscription/plan/marketing terminology or primary controls
 *  - no permanent Delete / Bulk Delete in the primary UI
 *  - no duplicate User Activity Log tab (Admin Activity is canonical)
 */
import { describe, it, expect } from "bun:test";

declare const require: (m: string) => any;

function read(rel: string): string {
  const fs = require("fs") as { readFileSync(p: string, enc: string): string };
  return fs.readFileSync(rel, "utf8");
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const usersPage = stripComments(read("src/pages/admin/components/users/UsersV2.tsx"));
const usersTable = stripComments(read("src/pages/admin/components/users/UsersV2Table.tsx"));
const adminRouting = stripComments(read("src/pages/admin/layout/adminSectionElements.tsx"));
const combined = `${usersPage}\n${usersTable}`;

function absent(re: RegExp, hay: string): boolean {
  return !re.test(hay);
}

describe("Users V2 route contract", () => {
  it("has a Users heading and does not use plan/marketing terminology", () => {
    expect(usersPage.includes(">Users<") || />\s*Users\s*</.test(usersPage)).toBe(true);
    expect(absent(/marketing/i, combined)).toBe(true);
    expect(absent(/Assign Plan/i, combined)).toBe(true);
    expect(absent(/Cancel Subscription/i, combined)).toBe(true);
    expect(absent(/subscription tier/i, combined)).toBe(true);
  });

  it("does not render subscription columns or tier filter", () => {
    expect(absent(/SubscriptionBadge/, combined)).toBe(true);
    expect(absent(/tierFilter/, combined)).toBe(true);
    expect(absent(/Subscription<\/TableHead>/, combined)).toBe(true);
  });

  it("does not expose permanent Delete or Bulk Delete in the primary UI", () => {
    expect(absent(/onDeleteUser|bulkDeleteUsers|BulkActionsBar/, combined)).toBe(true);
    expect(absent(/>Delete user</i, combined)).toBe(true);
    expect(absent(/>Delete All</i, combined)).toBe(true);
  });

  it("does not embed a duplicate User Activity Log tab", () => {
    expect(absent(/UserActivityLog/, combined)).toBe(true);
    expect(absent(/Activity Log/, combined)).toBe(true);
    expect(usersPage.includes("/admin/trust/admin-activity")).toBe(true);
  });

  it("keeps essential People actions and 44px touch targets", () => {
    expect(/New user|Create user/i.test(usersPage)).toBe(true);
    expect(/Refresh/.test(usersPage)).toBe(true);
    expect(/Export/i.test(usersPage)).toBe(true);
    expect(/reset/i.test(usersTable)).toBe(true);
    expect(/Resend/i.test(usersTable)).toBe(true);
    expect(/min-h-\[44px\]/.test(usersTable)).toBe(true);
    expect(/min-h-\[44px\]/.test(usersPage)).toBe(true);
  });

  it("routes /admin/users to the lean V2 page and no longer imports legacy shells", () => {
    expect(adminRouting.includes('import("../components/users/UsersV2")')).toBe(true);
    expect(adminRouting.includes("users: wrap(<UsersV2 />)")).toBe(true);
    expect(absent(/UsersManagement/, adminRouting)).toBe(true);
    expect(absent(/EmailAnalyticsDashboard/, adminRouting)).toBe(true);
  });
});
