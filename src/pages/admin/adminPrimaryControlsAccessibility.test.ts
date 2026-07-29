import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const CASES = [
  ["src/pages/admin/sections/orders/OrdersV2Page.tsx", 'aria-label="Search orders"'],
  [
    "src/pages/admin/sections/orders/PaymentEventsPage.tsx",
    'aria-label="Filter payment events by order UUID"',
  ],
  [
    "src/pages/admin/sections/orders/EntitlementsPage.tsx",
    'aria-label="Search entitlements"',
  ],
  ["src/pages/admin/sections/orders/RefundsPage.tsx", 'aria-label="Search refunds"'],
  [
    "src/pages/admin/sections/orders/RecoveryPage.tsx",
    'aria-label="Find order to reconcile"',
  ],
  [
    "src/pages/admin/sections/orders/DiscountsPage.tsx",
    'aria-label="Search discount codes"',
  ],
  [
    "src/components/admin/EmailTemplatesManagement.tsx",
    'aria-label="Search legacy email templates"',
  ],
] as const;

describe("Admin V2 primary controls accessibility", () => {
  for (const [file, accessibleName] of CASES) {
    it(`${file} names its primary search or reconciliation input`, () => {
      expect(readFileSync(file, "utf8")).toContain(accessibleName);
    });
  }
});
