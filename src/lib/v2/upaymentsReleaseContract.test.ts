import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const shared = read("supabase/functions/_shared/v2Upayments.ts");
const statusFunction = read("supabase/functions/v2-upayments-status/index.ts");
const webhookFunction = read("supabase/functions/v2-upayments-webhook/index.ts");
const refundFunction = read("supabase/functions/v2-upayments-refund/index.ts");
const commerceSchema = read(
  "supabase/migrations/20260722200346_50f9cfd4-21d8-4658-a0f2-53cf981920df.sql",
);
const hardenedCommerce = read(
  "supabase/migrations/20260723071401_a7375244-a0c6-4148-9ec1-510f51171700.sql",
);

describe("UPayments release contract", () => {
  it("uses exact payment status allowlists and keeps unknown results pending", () => {
    expect(shared).toContain(
      'const PAY_CAPTURED = new Set(["CAPTURED","SUCCESS","PAID"])',
    );
    expect(shared).toContain(
      'const PAY_FAILED_ALIASES = new Set(["NOT CAPTURED","NOT_CAPTURED"])',
    );
    expect(shared).toContain(
      'const PAY_CANCELLED = new Set(["CANCELLED","CANCELED","USER_CANCELLED","VOIDED"])',
    );
    expect(shared).toContain(
      'return { verdict: "unknown", normalized: n }',
    );
    expect(shared).toContain("NO substring/contains matching");
  });

  it("re-verifies webhook hints with the provider before settlement", () => {
    expect(webhookFunction).toContain("validateWebhookEnvelope");
    expect(webhookFunction).toContain("providerFetch");
    expect(webhookFunction).toContain("v2_claim_payment_status_check");
    expect(webhookFunction).toContain("v2_settle_verified_upayments_payment");
    expect(webhookFunction).toContain(
      'if (sx.currency.toUpperCase() !== "KWD")',
    );
    expect(webhookFunction).toContain(
      'if (providerAmount !== amountFils)',
    );
  });

  it("treats cancellation as terminal failure and unknown states as non-mutating", () => {
    for (const source of [statusFunction, webhookFunction]) {
      expect(source).toContain(
        'verdict.verdict === "failed" || verdict.verdict === "cancelled"',
      );
      expect(source).toContain(
        'return jsonResponse({ status: "pending", reason: verdict.verdict }, 202, origin)',
      );
    }
    expect(statusFunction).toContain(
      "pending / unknown: never mutate money state",
    );
  });

  it("rejects captured amount or currency mismatches before entitlement grant", () => {
    for (const source of [statusFunction, webhookFunction]) {
      expect(source).toContain('"currency_mismatch"');
      expect(source).toContain('"amount_mismatch"');
      expect(source.indexOf('"currency_mismatch"')).toBeLessThan(
        source.indexOf('"v2_settle_verified_upayments_payment"'),
      );
    }
    expect(hardenedCommerce).toContain("RAISE EXCEPTION 'amount_mismatch'");
    expect(hardenedCommerce).toContain(
      "CREATE OR REPLACE FUNCTION public.v2_settle_verified_upayments_payment",
    );
  });

  it("uses deterministic external event ids backed by a database uniqueness constraint", () => {
    expect(shared).toContain(
      "export function eventIdForStatus(",
    );
    expect(shared).toContain(
      "export function eventIdForRefund(",
    );
    expect(commerceSchema).toContain("UNIQUE (provider, external_event_id)");
    expect(hardenedCommerce).toContain(
      "ON CONFLICT (provider, external_event_id) DO NOTHING",
    );
  });

  it("does not revoke access for pending or unknown refund states", () => {
    expect(refundFunction).toContain(
      "pending / unknown: never revoke, never mutate credit/ownership",
    );
    expect(refundFunction).toContain(
      'eventIdForRefund(refundId, "status_processed"',
    );
    expect(refundFunction).toContain(
      'eventIdForRefund(refundId, "status_failed"',
    );
    expect(refundFunction).toContain('"provider_reference_mismatch"');
    expect(refundFunction).toContain('"provider_refund_id_mismatch"');
  });
});
