// Deterministic tests for the Phase 6C UPayments compatibility patch.
// Run with: deno test --allow-net --allow-env supabase/functions/_shared/v2Upayments_test.ts
import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";

import {
  validateWebhookEnvelope,
  loadCustomerFields,
  kwdDecimalToFils,
  filsToKwdDecimal,
  normalizePaymentStatus,
  loadUpaymentsConfig,
} from "./v2Upayments.ts";

// ---------------- validateWebhookEnvelope ----------------

Deno.test("webhook: official flat KNET/card envelope with documented fields is accepted", () => {
  const body = {
    payment_id: "1234567",
    result: "CAPTURED",
    post_date: "0724",
    tran_id: "202607240001",
    ref: "REF-abc",
    track_id: "UPAY-TRK-1",
    auth: "A12345",
    order_id: "ORD-9",
    requested_order_id: "M-REF-22",
    refund_order_id: "",
    payment_type: "k",
    invoice_id: "INV-1",
    transaction_date: "2026-07-24T10:00:00Z",
    receipt_id: "RCPT-1",
    trn_udf: "note",
  };
  const r = validateWebhookEnvelope(body);
  assertEquals(r, { ok: true });
});

Deno.test("webhook: unknown top-level field is rejected", () => {
  const body = {
    track_id: "T1",
    requested_order_id: "M-1",
    payment_status: "CAPTURED",
    unexpected_field: "x",
  };
  const r = validateWebhookEnvelope(body);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, "invalid_body");
});

Deno.test("webhook: unknown key inside data is rejected", () => {
  const body = {
    data: { track_id: "T1", requested_order_id: "M-1", weird_key: "x" },
  };
  const r = validateWebhookEnvelope(body);
  assertEquals(r.ok, false);
});

Deno.test("webhook: envelope with only documented fields resolves to an identifier", () => {
  // Contains no legacy identifiers other than the doc-field aliases.
  const body = {
    payment_id: "P1",
    result: "FAILED",
    order_id: "ORD-42",
  };
  const r = validateWebhookEnvelope(body);
  assertEquals(r, { ok: true });
});

Deno.test("webhook: envelope with zero identifier hints is rejected as unresolvable", () => {
  const body = { result: "CAPTURED", payment_type: "k" };
  const r = validateWebhookEnvelope(body);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.error, "unresolvable");
});

Deno.test("webhook: non-object body is rejected", () => {
  assertEquals(validateWebhookEnvelope(null).ok, false);
  assertEquals(validateWebhookEnvelope("x").ok, false);
  assertEquals(validateWebhookEnvelope([]).ok, false);
});

// ---------------- loadCustomerFields ----------------

function mockSvc(profile: Record<string, unknown> | null, authEmail = "") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc: any = {
    from(_t: string) {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() { return { data: profile }; },
      };
    },
    auth: {
      admin: {
        async getUserById() { return { data: { user: { email: authEmail } } }; },
      },
    },
  };
  return svc;
}

Deno.test("customer: long email (>50) is omitted, not truncated", async () => {
  const longEmail = "a".repeat(45) + "@example.com"; // 57 chars
  const svc = mockSvc({ email: longEmail, first_name: "A", last_name: "B", phone_number: "" });
  const out = await loadCustomerFields(svc, "u-1");
  assertEquals(out.email, undefined);
  assertEquals(out.uniqueId, "u-1");
});

Deno.test("customer: valid short email accepted", async () => {
  const svc = mockSvc({ email: "ok@example.com", first_name: "", last_name: "", phone_number: "" });
  const out = await loadCustomerFields(svc, "u-2");
  assertEquals(out.email, "ok@example.com");
});

Deno.test("customer: long name capped to 50 chars", async () => {
  const longName = "Firstname " + "X".repeat(200);
  const svc = mockSvc({ first_name: longName, last_name: "Y", phone_number: "" });
  const out = await loadCustomerFields(svc, "u-3");
  assert(out.name !== undefined);
  assert(out.name!.length <= 50, `name too long: ${out.name!.length}`);
});

Deno.test("customer: valid E.164 mobile accepted", async () => {
  const svc = mockSvc({ first_name: "A", last_name: "B", phone_number: "+96599123456" });
  const out = await loadCustomerFields(svc, "u-4");
  assertEquals(out.mobile, "+96599123456");
});

Deno.test("customer: overlong mobile (>15) omitted", async () => {
  const svc = mockSvc({ first_name: "A", last_name: "B", phone_number: "+123456789012345678" });
  const out = await loadCustomerFields(svc, "u-5");
  assertEquals(out.mobile, undefined);
});

Deno.test("customer: invalid mobile (missing +) omitted", async () => {
  const svc = mockSvc({ first_name: "A", last_name: "B", phone_number: "96599123456" });
  const out = await loadCustomerFields(svc, "u-6");
  assertEquals(out.mobile, undefined);
});

// ---------------- existing config/amount/status behavior unchanged ----------------

Deno.test("config: V2_UPAYMENTS_ENABLED unset returns null", () => {
  Deno.env.delete("V2_UPAYMENTS_ENABLED");
  assertEquals(loadUpaymentsConfig(), null);
});

Deno.test("amount: KWD decimal <-> fils roundtrip preserved", () => {
  assertEquals(kwdDecimalToFils("25.000"), 25_000);
  assertEquals(filsToKwdDecimal(25_000), "25.000");
  assertEquals(filsToKwdDecimal(1), "0.001");
});

Deno.test("status: allowlists unchanged", () => {
  assertEquals(normalizePaymentStatus("CAPTURED").verdict, "captured");
  assertEquals(normalizePaymentStatus("FAILED").verdict, "failed");
  assertEquals(normalizePaymentStatus("PENDING").verdict, "pending");
  assertEquals(normalizePaymentStatus("CANCELLED").verdict, "cancelled");
  assertEquals(normalizePaymentStatus("SOMETHING_ELSE").verdict, "unknown");
});
