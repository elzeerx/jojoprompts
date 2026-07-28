import { describe, expect, it } from "bun:test";
import { reconstructLegacyUpaymentsFils } from "@/lib/v2/legacyTransactions";

const plan = {
  id: "plan",
  name: "Ultimate",
  tier: "ultimate",
  price_usd: 100,
  is_lifetime: true,
};

describe("reconstructLegacyUpaymentsFils", () => {
  it("mirrors the approved historical plan ratio mapping", () => {
    expect(
      reconstructLegacyUpaymentsFils({
        amount_usd: 100,
        currency: "KWD",
        payment_gateway: "upayments",
        subscription_plans: plan,
      }),
    ).toBe(30_000);
    expect(
      reconstructLegacyUpaymentsFils({
        amount_usd: 50,
        currency: "KWD",
        payment_gateway: "upayments",
        subscription_plans: plan,
      }),
    ).toBe(15_000);
  });

  it("refuses ambiguous or non-UPayments values", () => {
    expect(
      reconstructLegacyUpaymentsFils({
        amount_usd: 100,
        currency: "USD",
        payment_gateway: "upayments",
        subscription_plans: plan,
      }),
    ).toBeNull();
    expect(
      reconstructLegacyUpaymentsFils({
        amount_usd: 100,
        currency: "KWD",
        payment_gateway: "paypal",
        subscription_plans: plan,
      }),
    ).toBeNull();
    expect(
      reconstructLegacyUpaymentsFils({
        amount_usd: 101,
        currency: "KWD",
        payment_gateway: "upayments",
        subscription_plans: plan,
      }),
    ).toBeNull();
  });
});
