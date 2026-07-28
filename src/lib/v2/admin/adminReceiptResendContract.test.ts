/**
 * Audited admin receipt-resend flow — source & contract guarantees.
 *
 * These tests verify the *design invariants* end-to-end across:
 *   - the reviewed forward-only migration
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
  parseReceiptResendCommand,
  parseResendBody,
  REASON_MAX,
  REASON_MIN,
} from "../../../../supabase/functions/v2-admin-resend-order-receipt/decisions";

const bunGlobal = (globalThis as unknown as {
  Bun: { file: (p: string) => { text: () => Promise<string>; exists: () => Promise<boolean> } };
}).Bun;

const MIGRATION = "supabase/migrations/20260728152000_admin_receipt_resend_requests.sql";
const SUPABASE_CONFIG = "supabase/config.toml";
const SHARED_RECEIPT = "supabase/functions/_shared/v2ReceiptDelivery.ts";
const RESEND_CLIENT = "supabase/functions/_shared/resendClient.ts";
const FN_INDEX = "supabase/functions/v2-admin-resend-order-receipt/index.ts";
const HOOK = "src/hooks/admin/v2/useOrderReceiptResends.ts";
const V2_FLAGS = "src/config/v2Flags.ts";

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

describe("receiptResend / command parser", () => {
  it("accepts a same-request reconciliation command only", () => {
    expect(parseReceiptResendCommand({ request_id: VALID_UUID })).toEqual({
      ok: true,
      mode: "reconcile",
      request_id: VALID_UUID,
    });
  });

  it("accepts a bounded manual provider-review resolution", () => {
    expect(parseReceiptResendCommand({
      request_id: VALID_UUID,
      resolution: "sent",
      reason: "Verified in Resend dashboard",
    })).toEqual({
      ok: true,
      mode: "resolve",
      request_id: VALID_UUID,
      resolution: "sent",
      reason: "Verified in Resend dashboard",
    });
  });

  it("rejects mixed commands and unexpected resolution fields", () => {
    for (const body of [
      { request_id: VALID_UUID, email: "attacker@example.com" },
      { request_id: VALID_UUID, resolution: "maybe", reason: "checked provider" },
      { request_id: VALID_UUID, resolution: "sent", reason: "ok" },
      { order_id: VALID_UUID, reason: "Customer asked", request_id: VALID_UUID },
    ]) {
      expect(parseReceiptResendCommand(body).ok).toBe(false);
    }
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
    ["uniq_v2_receipt_resend_active", "pending_exists", 409],
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

describe("receiptResend / migration invariants", () => {
  it("creates the resend requests table with the required contract", async () => {
    const sql = await bunGlobal.file(MIGRATION).text();
    expect(sql.includes("CREATE TABLE public.v2_order_receipt_resend_requests")).toBe(true);
    expect(sql.includes("REFERENCES public.orders(id) ON DELETE CASCADE")).toBe(true);
    expect(sql.includes(
      "CHECK (status IN ('pending','processing','reconciliation_required','sent','failed'))",
    )).toBe(true);
    expect(sql.includes("char_length(reason) BETWEEN 3 AND 300")).toBe(true);
    // At most one active request per order.
    expect(
      /CREATE UNIQUE INDEX .* WHERE status IN \('pending','processing','reconciliation_required'\)/s
        .test(sql),
    ).toBe(true);
    // Admin RLS SELECT only; no write policies.
    expect(sql.includes("CREATE POLICY admin_read_receipt_resend_requests")).toBe(true);
    expect(/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE)/i.test(sql)).toBe(false);
    // Grants
    expect(sql.includes("GRANT SELECT ON public.v2_order_receipt_resend_requests TO authenticated"))
      .toBe(true);
    expect(sql.includes("GRANT ALL ON public.v2_order_receipt_resend_requests TO service_role"))
      .toBe(true);
    expect(sql.includes("FROM PUBLIC, anon, authenticated")).toBe(true);
  });

  it("keeps exact provider payload snapshots service-role-only", async () => {
    const sql = await bunGlobal.file(MIGRATION).text();
    expect(sql.includes("CREATE TABLE public.v2_order_receipt_resend_payloads")).toBe(true);
    expect(sql.includes("GRANT ALL ON public.v2_order_receipt_resend_payloads TO service_role"))
      .toBe(true);
    expect(sql).toMatch(
      /REVOKE ALL ON TABLE public\.v2_order_receipt_resend_payloads\s+FROM PUBLIC, anon, authenticated/,
    );
    expect(sql).not.toMatch(
      /GRANT (SELECT|INSERT|UPDATE|DELETE).*v2_order_receipt_resend_payloads.*authenticated/,
    );
    expect(sql.includes("ALTER TABLE public.v2_order_receipt_resend_payloads ENABLE ROW LEVEL SECURITY"))
      .toBe(true);
  });

  it("exposes service-role-only SECURITY DEFINER RPCs with search_path=''", async () => {
    const sql = await bunGlobal.file(MIGRATION).text();
    for (const fn of [
      "v2_internal_create_receipt_resend_request",
      "v2_internal_claim_receipt_resend_request",
      "v2_internal_require_receipt_resend_reconciliation",
      "v2_internal_claim_receipt_resend_reconciliation",
      "v2_internal_resolve_receipt_resend_reconciliation",
      "v2_internal_complete_receipt_resend_request",
      "v2_internal_fail_receipt_resend_request",
    ]) {
      expect(sql.includes(`FUNCTION public.${fn}`)).toBe(true);
      expect(sql.includes(`REVOKE ALL ON FUNCTION public.${fn}`)).toBe(true);
      expect(sql.includes(`GRANT EXECUTE ON FUNCTION public.${fn}`)).toBe(true);
    }
    // security definer + hardened search_path applied
    const defCount = (sql.match(/SECURITY DEFINER SET search_path = ''/g) || []).length;
    expect(defCount).toBeGreaterThanOrEqual(7);
  });

  it("enforces paid + partially_refunded eligibility and rate rules in create RPC", async () => {
    const sql = await bunGlobal.file(MIGRATION).text();
    expect(sql.includes("IN ('paid','partially_refunded')")).toBe(true);
    expect(sql.includes("interval '5 minutes'")).toBe(true);
    expect(sql.includes("v_recent_order_count >= 5")).toBe(true);
    expect(sql.includes("v_recent_admin_count >= 50")).toBe(true);
    expect(sql.includes("pg_advisory_xact_lock")).toBe(true);
    expect(sql.includes("FOR UPDATE")).toBe(true);
    expect(sql.includes("actor_user_id")).toBe(true);
    // The create-event metadata never contains email/amount/items/HTML.
    const eventAt = sql.indexOf("'order_receipt_resend_requested'");
    expect(eventAt).toBeGreaterThan(-1);
    const auditFragment = sql.slice(eventAt, eventAt + 350);
    for (const forbidden of ["'email'", "user_email", "html", "amount_fils", "line_total"]) {
      expect(auditFragment.includes(forbidden)).toBe(false);
    }
  });

  it("can close pre-send claim failures without leaving a permanent active request", async () => {
    const sql = await bunGlobal.file(MIGRATION).text();
    expect(sql).toMatch(
      /v2_internal_fail_receipt_resend_request[\s\S]*WHERE id = p_request_id AND status IN \('pending','processing'\)/,
    );
  });

  it("bounds automatic reconciliation to Resend's safe key-retention window", async () => {
    const sql = await bunGlobal.file(MIGRATION).text();
    expect(sql.includes("interval '23 hours'")).toBe(true);
    expect(sql.includes("reconciliation_attempts >= 5")).toBe(true);
    expect(sql.includes("interval '2 minutes'")).toBe(true);
    expect(sql.includes("v2_internal_resolve_receipt_resend_reconciliation")).toBe(true);
  });

  it("registers the Edge Function with JWT verification enabled", async () => {
    const config = await bunGlobal.file(SUPABASE_CONFIG).text();
    expect(config).toMatch(
      /\[functions\.v2-admin-resend-order-receipt\]\s+verify_jwt = true/,
    );
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

  it("separates exact provider-payload construction from transport", async () => {
    const src = await bunGlobal.file(SHARED_RECEIPT).text();
    expect(src.includes("export interface ReceiptProviderPayload")).toBe(true);
    expect(src.includes("export function buildReceiptProviderPayload")).toBe(true);
    expect(src.includes("export async function sendReceiptPayloadViaResend")).toBe(true);
  });

  it("distinguishes definitive provider rejection from delivery-unknown transport failure", async () => {
    const src = await bunGlobal.file(SHARED_RECEIPT).text();
    expect(src.includes("ReceiptDeliveryFailureDisposition")).toBe(true);
    expect(src.includes('"definitive" | "unknown"')).toBe(true);
    expect(src.includes('ReceiptDeliveryError("resend_delivery_unknown", "unknown")')).toBe(true);
    expect(src.includes('result.providerCode === "concurrent_idempotent_requests"')).toBe(true);
    expect(src.includes("result.status >= 500")).toBe(true);
  });

  it("uses the direct REST helper that sends a real Idempotency-Key header", async () => {
    const receipt = await bunGlobal.file(SHARED_RECEIPT).text();
    const client = await bunGlobal.file(RESEND_CLIENT).text();
    expect(receipt.includes('import { sendResendEmail } from "./resendClient.ts"')).toBe(true);
    expect(client.includes("'Idempotency-Key': idempotencyKey")).toBe(true);
    expect(receipt.includes("resend@2.0.0")).toBe(false);
  });
});

describe("receiptResend / edge function invariants", () => {
  it("uses the RESEND-scoped key and never falls back to the order key", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    expect(src.includes("receiptResendIdempotencyKey(args.requestId)")).toBe(true);
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

  it("persists the exact provider payload before the first provider call", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    const persistAt = src.indexOf("persistReceiptPayload(");
    const deliverAt = src.lastIndexOf("deliverPersistedReceipt(service");
    expect(persistAt).toBeGreaterThan(-1);
    expect(deliverAt).toBeGreaterThan(persistAt);
    expect(src.includes('from("v2_order_receipt_resend_payloads")')).toBe(true);
  });

  it("reconciles the same request and same idempotency key", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    expect(src.includes("v2_internal_claim_receipt_resend_reconciliation")).toBe(true);
    expect(src.includes("loadPersistedReceiptPayload(service, command.request_id)")).toBe(true);
    expect(src.includes("receiptResendIdempotencyKey(args.requestId)")).toBe(true);
  });

  it("supports explicit manual provider-review resolution", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    expect(src.includes('command.mode === "resolve"')).toBe(true);
    expect(src.includes("v2_internal_resolve_receipt_resend_reconciliation")).toBe(true);
  });

  it("closes claim failures and reconciles any unprovable state", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    expect(src.includes('markResendFailed(')).toBe(true);
    expect(src.includes('"claim_failed"')).toBe(true);
    expect(src.includes("if (!closed) return reconciliationRequired(requestId)")).toBe(true);
  });

  it("never marks a delivery-unknown provider call as failed", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    expect(src.includes('sendErr.disposition === "unknown"')).toBe(true);
    expect(src.includes("return reconciliationRequired(requestId)")).toBe(true);
  });

  it("requires admin JWT via has_role and rejects non-POST", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    expect(src.includes("has_role")).toBe(true);
    expect(src.includes("method_not_allowed")).toBe(true);
  });

  it("never reads client recipient/amount/items overrides from the request body", async () => {
    const src = await bunGlobal.file(FN_INDEX).text();
    // The command parser is the only browser-body access point. It accepts
    // new resend, same-request reconciliation, or manual provider review.
    expect(src.includes("parsed.order_id") || src.includes("const { order_id, reason } = parsed"))
      .toBe(false);
    expect(src.includes("parseReceiptResendCommand(parsedJson)")).toBe(true);
    // Guard against any accidental direct body reads for other fields.
    for (const forbidden of [
      "parsedJson.email",
      "parsedJson.amount",
      "parsedJson.items",
      "parsedJson.to",
      "parsedJson.recipient",
      "parsedJson.html",
      "parsed.email",
      "parsed.amount",
      "parsed.items",
      "parsed.to",
      "parsed.recipient",
      "parsed.html",
    ]) {
      expect(src.includes(forbidden)).toBe(false);
    }
  });
});

describe("receiptResend / UI hook", () => {
  it("mutations invoke only the audited edge function with strict command bodies", async () => {
    const src = await bunGlobal.file(HOOK).text();
    expect(src.includes("v2-admin-resend-order-receipt")).toBe(true);
    expect(src.includes("order_id: orderId")).toBe(true);
    expect(src.includes("reason: trimmed")).toBe(true);
    expect(src.includes("request_id: requestId")).toBe(true);
    expect(src.includes("resolution,")).toBe(true);
    // Read side goes through authenticated RLS SELECT, not RPC.
    expect(src.includes(".rpc(")).toBe(false);
  });

  it("stays fail-closed until the migration and function pass runtime QA", async () => {
    const flags = await bunGlobal.file(V2_FLAGS).text();
    const hook = await bunGlobal.file(HOOK).text();
    expect(flags.includes("export const ADMIN_RECEIPT_RESEND_ENABLED = false")).toBe(true);
    expect(hook.includes("!!orderId && ADMIN_RECEIPT_RESEND_ENABLED")).toBe(true);
    expect(hook.includes('throw new Error("feature_unavailable")')).toBe(true);
  });
});
