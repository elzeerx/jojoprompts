/**
 * Audited admin receipt-resend flow — source & contract guarantees.
 *
 * These tests verify the *design invariants* end-to-end across:
 *   - the reviewed forward-only migration draft
 *   - the shared receipt module (distinct idempotency key)
 *   - the new Edge Function contract
 *   - the admin UI hook
 *
 * Runs under Bun (no Deno runtime required); it inspects file contents
 * and exercises pure decision helpers.
 */
import { describe, it, expect } from "bun:test";
import {
  isValidUuid,
  mapCreateRpcError,
  normalizeReason,
  parseResendBody,
  REASON_MAX,
  REASON_MIN,
} from "../../../../supabase/functions/v2-admin-resend-order-receipt/decisions";

const bunGlobal = (globalThis as unknown as {
  Bun: { file: (p: string) => { text: () => Promise<string>; exists: () => Promise<boolean> } };
}).Bun;

const MIGRATION_DRAFT = "docs/security/drafts/20260728152000_admin_receipt_resend_requests.sql";
const SHARED_RECEIPT = "supabase/functions/_shared/v2ReceiptDelivery.ts";
const FN_INDEX = "supabase/functions/v2-admin-resend-order-receipt/index.ts";
const HOOK = "src/hooks/admin/v2/useOrderReceiptResends.ts";

const VALID_UUID = "9c1b2c3d-4e5f-4abc-8def-1234567890ab";

describe("receiptResend / body parser", () => {
  it("accepts { order_id, reason } only", () => {
    const ok = parseResendBody({ order_id: VALID_UUID, reason: "Customer asked" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.order_id).toBe(VALID_UUID);
      expect(ok.reason).toBe("Customer asked");
    }
  });

  it("rejects any unexpected field (recipient/email/amount/items overrides)", () => {
    for (const field of ["email", "amount", "items", "to", "recipient", "html"]) {
      const res = parseResendBody({
        order_id: VALID_UUID,
        reason: "reasonable text",
        [field]: "attack",
      });
      expect(res.ok).toBe(false);
      if (res.ok === false) expect(res.code).toBe("unexpected_field");
    }
  });

  it("rejects invalid uuids", () => {
    const res = parseResendBody({ order_id: "not-a-uuid", reason: "hello there" });
    expect(res.ok).toBe(false);
    if (res.ok === false) expect(res.code).toBe("invalid_order_id");
  });

  it("enforces reason bounds", () => {
    expect(parseResendBody({ order_id: VALID_UUID, reason: "" }).ok).toBe(false);
    expect(parseResendBody({ order_id: VALID_UUID, reason: "ok" }).ok).toBe(false);
    expect(parseResendBody({ order_id: VALID_UUID, reason: "x".repeat(REASON_MAX + 1) }).ok).toBe(false);
    expect(parseResendBody({ order_id: VALID_UUID, reason: "x".repeat(REASON_MIN) }).ok).toBe(true);
  });

  it("rejects null / array / non-object bodies", () => {
    expect(parseResendBody(null).ok).toBe(false);
    expect(parseResendBody([]).ok).toBe(false);
    expect(parseResendBody("hi").ok).toBe(false);
  });
});

describe("receiptResend / normalizeReason", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeReason("  hello   there  ")).toBe("hello there");
  });
  it("returns null for out-of-bounds input", () => {
    expect(normalizeReason("x")).toBe(null);
    expect(normalizeReason(null)).toBe(null);
  });
});

describe("receiptResend / uuid validator", () => {
  it("accepts canonical v4-like uuids", () => {
    expect(isValidUuid(VALID_UUID)).toBe(true);
  });
  it("rejects loose alphanumeric strings the old regex would have accepted", () => {
    expect(isValidUuid("gggggggg-gggg-gggg-gggg-gggggggggggg")).toBe(false);
    expect(isValidUuid("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });
});

describe("receiptResend / RPC error mapping", () => {
  const cases: Array<[string, string, number]> = [
    ["forbidden", "forbidden", 403],
    ["order_not_found", "order_not_found", 404],
    ["order_not_eligible", "order_not_eligible", 409],
    ["missing_recipient", "missing_recipient", 409],
    ["pending_exists", "pending_exists", 409],
    ["cooldown_active", "cooldown_active", 429],
    ["order_cap_exceeded", "order_cap_exceeded", 429],
    ["admin_cap_exceeded", "admin_cap_exceeded", 429],
    ["reason_invalid_length", "invalid_reason", 400],
    ["invalid_arguments", "invalid_arguments", 400],
    ["something else", "resend_request_failed", 500],
  ];
  for (const [msg, code, status] of cases) {
    it(`maps "${msg}" -> ${code}/${status}`, () => {
      expect(mapCreateRpcError(msg)).toEqual({ code, status });
    });
  }
});

describe("receiptResend / migration draft invariants", () => {
  it("creates the resend requests table with the required contract", async () => {
    const sql = await bunGlobal.file(MIGRATION_DRAFT).text();
    expect(sql.includes("CREATE TABLE public.v2_order_receipt_resend_requests")).toBe(true);
    expect(sql.includes("REFERENCES public.orders(id) ON DELETE CASCADE")).toBe(true);
    expect(sql.includes("CHECK (status IN ('pending','processing','sent','failed'))")).toBe(true);
    expect(sql.includes("char_length(reason) BETWEEN 3 AND 300")).toBe(true);
    // At most one active request per order.
    expect(/CREATE UNIQUE INDEX .* WHERE status IN \('pending','processing'\)/s.test(sql)).toBe(true);
    // Admin RLS SELECT only; no write policies.
    expect(sql.includes("CREATE POLICY admin_read_receipt_resend_requests")).toBe(true);
    expect(/FOR (INSERT|UPDATE|DELETE)/.test(sql)).toBe(false);
    // Grants
    expect(sql.includes("GRANT SELECT ON public.v2_order_receipt_resend_requests TO authenticated"))
      .toBe(true);
    expect(sql.includes("GRANT ALL ON public.v2_order_receipt_resend_requests TO service_role"))
      .toBe(true);
  });

  it("exposes 4 service-role-only SECURITY DEFINER RPCs with search_path=''", async () => {
    const sql = await bunGlobal.file(MIGRATION_DRAFT).text();
    for (const fn of [
      "v2_internal_create_receipt_resend_request",
      "v2_internal_claim_receipt_resend_request",
      "v2_internal_complete_receipt_resend_request",
      "v2_internal_fail_receipt_resend_request",
    ]) {
      expect(sql.includes(`FUNCTION public.${fn}`)).toBe(true);
      expect(sql.includes(`REVOKE ALL ON FUNCTION public.${fn}`)).toBe(true);
      expect(sql.includes(`GRANT EXECUTE ON FUNCTION public.${fn}`)).toBe(true);
    }
    // security definer + hardened search_path applied
    const defCount = (sql.match(/SECURITY DEFINER SET search_path = ''/g) || []).length;
    expect(defCount).toBeGreaterThanOrEqual(4);
  });

  it("enforces paid + partially_refunded eligibility and rate rules in create RPC", async () => {
    const sql = await bunGlobal.file(MIGRATION_DRAFT).text();
    expect(sql.includes("IN ('paid','partially_refunded')")).toBe(true);
    expect(sql.includes("interval '5 minutes'")).toBe(true);
    expect(sql.includes("v_recent_order_count >= 5")).toBe(true);
    expect(sql.includes("v_recent_admin_count >= 50")).toBe(true);
    // Audit metadata never contains email/amount/items/HTML.
    for (const forbidden of ["'email'", "user_email", "html", "amount_fils", "line_total"]) {
      expect(sql.includes(forbidden)).toBe(false);
    }
  });
});

describe("receiptResend / shared receipt module", () => {
  it("exports a resend-scoped idempotency key that differs from the order key", async () => {
    const src = await bunGlobal.file(SHARED_RECEIPT).text();
    expect(src.includes("export function receiptResendIdempotencyKey")).toBe(true);
    expect(src.includes("v2-order-receipt-resend/")).toBe(true);
    // Original single-shot key is preserved.
    expect(src.includes("export function receiptIdempotencyKey")).toBe(true);
    expect(src.includes("`v2-order-receipt/${id}`")).toBe(true);
  });

  it("loadReceiptOrder supports partially_refunded when explicitly requested", async () => {
    const src = await bunGlobal.file(SHARED_RECEIPT).text();
    expect(src.includes("allowPartialRefund")).toBe(true);
    expect(src.includes('"partially_refunded"')).toBe(true);
  });

  it("sendReceiptViaResend accepts an explicit idempotency key", async () => {
    const src = await bunGlobal.file(SHARED_RECEIPT).text();
    // Signature includes the optional third arg used by the resend fn.
    expect(/sendReceiptViaResend\([^)]*idempotencyKey\?: string/s.test(src)).toBe(true);
  });
});

describe("receiptResend / edge function invariants", () => {
  it("uses the RESEND-scoped key and never falls back to the order key", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    expect(src.includes("receiptResendIdempotencyKey(requestId)")).toBe(true);
    expect(src.includes("receiptIdempotencyKey(")).toBe(false);
  });

  it("logs email_logs rows with the RESEND email_type (does not collide with v2_order_receipt)", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    expect(src.includes("'v2_order_receipt_resend'")).toBe(true);
  });

  it("returns reconciliation_required when provider succeeded but DB complete failed", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    expect(src.includes("reconciliation_required")).toBe(true);
    expect(src.includes("202")).toBe(true);
  });

  it("requires admin JWT via has_role and rejects non-POST", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    expect(src.includes("has_role")).toBe(true);
    expect(src.includes("method_not_allowed")).toBe(true);
  });

  it("never accepts client recipient/amount/items overrides", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    for (const forbidden of ["email:", "amount:", "items:", "to:", "recipient", "html:"]) {
      expect(src.includes(forbidden)).toBe(false);
    }
  });
});

describe("receiptResend / UI hook", () => {
  it("mutation invokes only the audited edge function with a stripped body", async () => {
    const src = await bunGlobal.file(HOOK).text();
    expect(src.includes("v2-admin-resend-order-receipt")).toBe(true);
    expect(src.includes("order_id: orderId")).toBe(true);
    expect(src.includes("reason: trimmed")).toBe(true);
    // Read side goes through authenticated RLS SELECT, not RPC.
    expect(src.includes(".rpc(")).toBe(false);
  });
});
