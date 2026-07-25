import { describe, it, expect } from "bun:test";
import {
  attentionTotal,
  environmentLabel,
  isHealthy,
  periodLabel,
  readinessRows,
  stripStatusFields,
  type PaymentSettingsStatus,
  type PaymentSettingsSummary,
} from "./paymentSettings";
import {
  PAYMENTS_NAV_LINKS,
  PAYMENTS_RECON_LINKS,
} from "./paymentsRoutes";

const baseStatus: PaymentSettingsStatus = {
  provider: "upayments",
  enabled: true,
  configured: true,
  environment: "production",
  api_token_configured: true,
  public_site_url_configured: true,
  public_site_url: "https://jojoprompts.com",
  currency: "KWD",
  recurring_billing: false,
  services: ["v2-upayments-checkout"],
};

describe("environmentLabel", () => {
  it("marks production ok, sandbox warn, invalid danger", () => {
    expect(environmentLabel("production").tone).toBe("ok");
    expect(environmentLabel("sandbox").tone).toBe("warn");
    expect(environmentLabel("invalid_or_unset").tone).toBe("danger");
  });
});

describe("readinessRows", () => {
  it("flags missing token as danger", () => {
    const rows = readinessRows({ ...baseStatus, api_token_configured: false, configured: false });
    const token = rows.find((r) => r.key === "api_token")!;
    expect(token.tone).toBe("danger");
    expect(token.value).toBe("Missing");
  });
  it("flags missing public site URL as danger", () => {
    const rows = readinessRows({
      ...baseStatus,
      public_site_url_configured: false,
      public_site_url: null,
      configured: false,
    });
    expect(rows.find((r) => r.key === "public_site_url")!.tone).toBe("danger");
  });
  it("recurring billing is always disabled in one-time model", () => {
    const rows = readinessRows(baseStatus);
    expect(rows.find((r) => r.key === "recurring")!.value).toContain("one-time");
  });
});

describe("periodLabel", () => {
  it("prints friendly all-time label", () => {
    expect(periodLabel("all_time")).toBe("All time");
  });
});

describe("attentionTotal / isHealthy", () => {
  const zero = {
    mismatches: 0, pending_past_due: 0, paid_without_entitlement: 0,
    credit_inconsistent: 0, duplicate_event_risk: 0, refund_alloc_over_item: 0,
    refund_alloc_over_order: 0, processed_missing_credit: 0,
    processed_item_unrevoked_entitlement: 0, threshold_lifetime_below_credit: 0,
  };
  it("sums nonzero findings", () => {
    expect(attentionTotal({ ...zero, mismatches: 2, pending_past_due: 3 })).toBe(5);
  });
  it("returns null on missing/invalid input (fail-closed)", () => {
    expect(attentionTotal(null)).toBeNull();
    expect(attentionTotal({ ...zero, mismatches: -1 })).toBeNull();
    expect(attentionTotal({ mismatches: "x" })).toBeNull();
  });
  it("healthy only when total is exactly zero", () => {
    expect(isHealthy(0)).toBe(true);
    expect(isHealthy(1)).toBe(false);
    expect(isHealthy(null)).toBe(false);
  });
});

describe("stripStatusFields", () => {
  it("removes forbidden secret-like fields", () => {
    const out = stripStatusFields({
      ...baseStatus,
      api_token: "sekret",
      secret: "nope",
      raw_env: { X: "Y" },
    });
    expect(out.api_token).toBeUndefined();
    expect(out.secret).toBeUndefined();
    expect(out.raw_env).toBeUndefined();
    expect(out.provider).toBe("upayments");
    expect(out.api_token_configured).toBe(true);
  });
  it("drops unknown keys silently", () => {
    const out = stripStatusFields({ ...baseStatus, extraneous: 123 });
    expect((out as Record<string, unknown>).extraneous).toBeUndefined();
  });
});

describe("PAYMENTS_NAV_LINKS canonical routes", () => {
  it("uses canonical Admin V2 order routes only", () => {
    const map = Object.fromEntries(PAYMENTS_NAV_LINKS.map((n) => [n.label, n.to]));
    expect(map["Orders"]).toBe("/admin/orders");
    expect(map["Payment events"]).toBe("/admin/orders/payment-events");
    expect(map["Entitlements"]).toBe("/admin/orders/entitlements");
    expect(map["Refunds"]).toBe("/admin/orders/refunds");
    expect(map["Recovery queue"]).toBe("/admin/orders/recovery");
    expect(map["Discounts"]).toBe("/admin/orders/discounts");
  });
  it("contains no legacy non-canonical routes", () => {
    const forbidden = ["/admin/payment-events", "/admin/refunds", "/admin/entitlements", "/admin/discounts"];
    for (const n of PAYMENTS_NAV_LINKS) {
      expect(forbidden).not.toContain(n.to);
    }
    for (const to of Object.values(PAYMENTS_RECON_LINKS)) {
      expect(forbidden).not.toContain(to);
    }
  });
  it("reconciliation link map targets canonical routes", () => {
    expect(PAYMENTS_RECON_LINKS.mismatches).toBe("/admin/orders/payment-events");
    expect(PAYMENTS_RECON_LINKS.duplicate_event_risk).toBe("/admin/orders/payment-events");
    expect(PAYMENTS_RECON_LINKS.credit_inconsistent).toBe("/admin/orders/entitlements");
    expect(PAYMENTS_RECON_LINKS.threshold_lifetime_below_credit).toBe("/admin/orders/entitlements");
    expect(PAYMENTS_RECON_LINKS.refund_alloc_over_item).toBe("/admin/orders/refunds");
    expect(PAYMENTS_RECON_LINKS.refund_alloc_over_order).toBe("/admin/orders/refunds");
    expect(PAYMENTS_RECON_LINKS.processed_missing_credit).toBe("/admin/orders/refunds");
    expect(PAYMENTS_RECON_LINKS.processed_item_unrevoked_entitlement).toBe("/admin/orders/refunds");
    expect(PAYMENTS_RECON_LINKS.pending_past_due).toBe("/admin/orders/recovery");
    expect(PAYMENTS_RECON_LINKS.paid_without_entitlement).toBe("/admin/orders");
  });
});

describe("payment_attempts.failed contract", () => {
  it("type surface exposes `failed` (not `verified_failed`)", () => {
    const sample: PaymentSettingsSummary["payment_attempts"] = {
      total: 10, verified_paid: 6, failed: 3, mismatch: 1,
    };
    expect(sample.failed).toBe(3);
    // @ts-expect-error verified_failed removed from contract
    expect(sample.verified_failed).toBeUndefined();
  });
});
