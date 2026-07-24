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
  filsToKwdNumber,
  normalizePaymentStatus,
  loadUpaymentsConfig,
  extractChargeFields,
  extractStatusFields,
  sanitizeProviderPayload,
  webhookLookupPriority,
  webhookIdentifierColumn,
  eventIdForStatus,
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

// ---------------- extractChargeFields (non-whitelabel hosted) ----------------

Deno.test("charge: official non-whitelabel response { status, data.link } derives session_id from URL", () => {
  const json = {
    status: true,
    data: {
      link: "https://sandbox.upayments.com/checkout?session_id=sess_abc123&x=1",
    },
  };
  const ex = extractChargeFields(json as Record<string, unknown>);
  assertEquals(ex.paymentUrl, "https://sandbox.upayments.com/checkout?session_id=sess_abc123&x=1");
  assertEquals(ex.sessionId, "sess_abc123");
  assertEquals(ex.trackId, null);
});

Deno.test("charge: explicit data.session_id wins over URL-derived value", () => {
  const json = {
    data: {
      session_id: "explicit_sess",
      link: "https://pay.upayments.com/?session_id=url_sess",
    },
  };
  const ex = extractChargeFields(json as Record<string, unknown>);
  assertEquals(ex.sessionId, "explicit_sess");
});

Deno.test("charge: spoofed non-upayments URL does NOT yield a derived session_id", () => {
  const json = {
    data: { link: "https://evil.example.com/checkout?session_id=leak_me" },
  };
  const ex = extractChargeFields(json as Record<string, unknown>);
  assertEquals(ex.sessionId, null);
});

Deno.test("charge: http (non-https) upayments URL does NOT yield a derived session_id", () => {
  const json = {
    data: { link: "http://sandbox.upayments.com/?session_id=insecure" },
  };
  const ex = extractChargeFields(json as Record<string, unknown>);
  assertEquals(ex.sessionId, null);
});

Deno.test("charge: upayments URL without session_id query returns null sessionId", () => {
  const json = {
    data: { link: "https://sandbox.upayments.com/checkout?foo=bar" },
  };
  const ex = extractChargeFields(json as Record<string, unknown>);
  assertEquals(ex.paymentUrl, "https://sandbox.upayments.com/checkout?foo=bar");
  assertEquals(ex.sessionId, null);
});

// ---------------- extractStatusFields: official data.transaction fixture ----

// Fixture matches the exact shape of the paid QA GET /get-payment-status
// response. Mirrors: status:true, data.transaction with track_id, session_id
// (per-transaction UUID), order_id, merchant_requested_order_id, result,
// status, currency_type, total_price.
const paidTxFixture = () => ({
  status: true,
  data: {
    transaction: {
      track_id: "UPAY-TRK-NEW-1",
      session_id: "tx-uuid-1111-2222",           // per-transaction UUID
      order_id: "UPAY-ORDER-42",
      merchant_requested_order_id: "MREF-abcdef0123456789ab", // 22 chars
      reference: "some-ref",
      result: "CAPTURED",
      status: "success",
      currency_type: "KWD",
      total_price: "0.900",
    },
  },
});

Deno.test("status: extracts fields from data.transaction, prefers merchant_requested_order_id", () => {
  const ex = extractStatusFields(paidTxFixture() as Record<string, unknown>);
  assertEquals(ex.trackId, "UPAY-TRK-NEW-1");
  assertEquals(ex.sessionId, "tx-uuid-1111-2222");
  assertEquals(ex.providerOrderId, "UPAY-ORDER-42");
  assertEquals(ex.merchantReference, "MREF-abcdef0123456789ab");
  assertEquals(ex.amountRaw, "0.900");
  assertEquals(ex.currency, "KWD");
  assertEquals(ex.result, "CAPTURED");
});

Deno.test("status: data.transaction.session_id is different from a hosted-checkout session id (semantic distinction)", () => {
  // The stored hosted session id (from POST /charge data.link) is a long
  // random string; the transaction.session_id is a distinct UUID. The
  // extractor surfaces the per-transaction one — callers MUST NOT compare
  // to the stored hosted id. This test just proves they can differ.
  const storedHostedSession =
    "sess_LONG_HOSTED_CHECKOUT_ID_ABCDEFGHIJKLMNOPQRSTUVWXYZ_1234567890";
  const ex = extractStatusFields(paidTxFixture() as Record<string, unknown>);
  assert(ex.sessionId !== storedHostedSession,
    "provider tx session_id should differ from stored hosted session id");
});

Deno.test("status: transaction values win over top-level/data fallbacks", () => {
  const json = {
    status: true,
    result: "FAILED",
    currency: "USD",
    amount: "9.999",
    data: {
      result: "PENDING", currency: "USD", amount: "1.000",
      transaction: {
        result: "CAPTURED", currency_type: "KWD", total_price: "0.900",
        merchant_requested_order_id: "MREF-1",
        track_id: "TRK-1", order_id: "ORD-1",
      },
    },
  };
  const ex = extractStatusFields(json as Record<string, unknown>);
  assertEquals(ex.result, "CAPTURED");
  assertEquals(ex.currency, "KWD");
  assertEquals(ex.amountRaw, "0.900");
  assertEquals(ex.merchantReference, "MREF-1");
});

// ---------------- sanitizeProviderPayload: transaction + no PII -----------

Deno.test("sanitize: includes safe transaction aliases and drops PII/URL/card", () => {
  const json = {
    status: true,
    data: {
      link: "https://sandbox.upayments.com/?session_id=leak",
      transaction: {
        track_id: "TRK-1",
        merchant_requested_order_id: "MREF-1",
        currency_type: "KWD",
        total_price: "0.900",
        result: "CAPTURED",
        // Should NOT be persisted:
        customer_email: "person@example.com",
        customer_name: "Real Name",
        card_number: "4111111111111111",
        cvv: "123",
        payment_url: "https://evil.example.com/x",
        product_name: "leak me",
      },
    },
  };
  const s = sanitizeProviderPayload("payment_status", json as Record<string, unknown>, 200);
  assertEquals(s.kind, "payment_status");
  assertEquals(s.http_status, 200);
  assertEquals(s.track_id, "TRK-1");
  assertEquals(s.merchant_requested_order_id, "MREF-1");
  assertEquals(s.currency_type, "KWD");
  assertEquals(s.total_price, "0.900");
  assertEquals(s.result, "CAPTURED");
  // PII / URL / card fields must be absent
  assert(!("customer_email" in s));
  assert(!("customer_name" in s));
  assert(!("card_number" in s));
  assert(!("cvv" in s));
  assert(!("payment_url" in s));
  assert(!("product_name" in s));
  assert(!("link" in s));
});

// ---------------- webhookLookupPriority resolution helper -----------------

Deno.test("resolve: priority is track_id → session_id → provider_order_id → merchant_reference", () => {
  const pri = webhookLookupPriority({
    trackId: "T", sessionId: "S", providerOrderId: "P", merchantReference: "M",
  });
  assertEquals(pri.map(p => p.kind),
    ["track_id","session_id","provider_order_id","merchant_reference"]);
  assertEquals(pri.map(p => p.value), ["T","S","P","M"]);
});

Deno.test("resolve: empty/duplicate/oversize identifiers are dropped", () => {
  const pri = webhookLookupPriority({
    trackId: "  ", sessionId: "S", providerOrderId: null,
    merchantReference: "S", // duplicate value under a different kind still kept
  });
  assertEquals(pri.length, 2);
  assertEquals(pri[0], { kind: "session_id", value: "S" });
  assertEquals(pri[1], { kind: "merchant_reference", value: "S" });

  const big = "x".repeat(300);
  const pri2 = webhookLookupPriority({
    trackId: big, sessionId: null, providerOrderId: null, merchantReference: "M",
  });
  assertEquals(pri2.length, 1);
  assertEquals(pri2[0].kind, "merchant_reference");
});

Deno.test("resolve: fresh provider track_id + stored merchant_reference falls through to merchant_reference match", () => {
  // Simulates initial callback where the fresh track_id doesn't exist locally
  // yet; the priority list still contains merchant_reference so a caller that
  // walks the list can resolve via that server-originated tie-breaker.
  const pri = webhookLookupPriority({
    trackId: "FRESH-TRK",  // will return 0 rows in real DB
    sessionId: null,
    providerOrderId: null,
    merchantReference: "MREF-abcdef0123456789ab",
  });
  assertEquals(pri[0].kind, "track_id");
  assertEquals(pri[pri.length - 1].kind, "merchant_reference");
});

Deno.test("resolve: column mapping is exact", () => {
  assertEquals(webhookIdentifierColumn("track_id"), "track_id");
  assertEquals(webhookIdentifierColumn("session_id"), "session_id");
  assertEquals(webhookIdentifierColumn("provider_order_id"), "provider_order_id");
  assertEquals(webhookIdentifierColumn("merchant_reference"), "merchant_reference");
});

// ---------------- webhook envelope accepts real payment_id fixture --------

Deno.test("webhook: real official flat payment envelope with all doc fields is accepted", () => {
  const body = {
    payment_id: "P1", result: "CAPTURED",
    track_id: "T1", requested_order_id: "MREF-1",
    invoice_id: "INV-1", receipt_id: "RCPT-1", trn_udf: "",
  };
  assertEquals(validateWebhookEnvelope(body), { ok: true });
});

// ---------------- event id stability (replay safety) ----------------------

Deno.test("event: eventIdForStatus is deterministic for same inputs (idempotency)", () => {
  const a = eventIdForStatus("ORDER-1", "TRK-1", "captured");
  const b = eventIdForStatus("ORDER-1", "TRK-1", "captured");
  assertEquals(a, b);
  const c = eventIdForStatus("ORDER-1", "TRK-1", "reject:amount_mismatch");
  assert(a !== c, "verdict change must yield different event id");
});

