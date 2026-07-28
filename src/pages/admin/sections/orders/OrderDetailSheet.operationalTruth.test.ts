/**
 * Order detail operational-truth contract (post admin-resend flow).
 *
 * Guards against regressions in the audited admin receipt-resend flow:
 *   1. The order detail drawer must still render receipt-delivery status.
 *   2. It must expose an explicit, confirmation-gated Resend receipt action
 *      wired to `useAdminResendOrderReceipt` -> `v2-admin-resend-order-receipt`.
 *   3. The client MUST NOT send recipient, amount, items, or email overrides
 *      to the edge function — only `{ order_id, reason }`.
 *   4. The edge function directory must exist with a POST/OPTIONS handler
 *      that does NOT accept client-supplied recipient/amount/items fields.
 */
import { describe, it, expect } from "bun:test";

const bunGlobal = (globalThis as unknown as {
  Bun: {
    file: (p: string) => { text: () => Promise<string>; exists: () => Promise<boolean> };
  };
}).Bun;

const SHEET_PATH = "src/pages/admin/sections/orders/OrderDetailSheet.tsx";
const READ_HOOK_PATH = "src/hooks/admin/v2/useOrderReceiptDelivery.ts";
const RESENDS_HOOK_PATH = "src/hooks/admin/v2/useOrderReceiptResends.ts";
const BLOCKER_DOC = "docs/security/RECEIPT_RESEND_BLOCKER.md";
const FN_INDEX = "supabase/functions/v2-admin-resend-order-receipt/index.ts";
const FN_DECISIONS = "supabase/functions/v2-admin-resend-order-receipt/decisions.ts";

describe("OrderDetailSheet operational truth (with audited resend)", () => {
  it("renders a Receipt delivery section", async () => {
    const src = await bunGlobal.file(SHEET_PATH).text();
    expect(src.includes("Receipt delivery")).toBe(true);
    expect(src.includes('data-testid="order-receipt-delivery"')).toBe(true);
  });

  it("read hook stays read-only", async () => {
    const hook = await bunGlobal.file(READ_HOOK_PATH).text();
    for (const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("]) {
      expect(hook.includes(forbidden)).toBe(false);
    }
  });

  it("wires the audited Resend receipt UI + confirmation", async () => {
    const src = await bunGlobal.file(SHEET_PATH).text();
    expect(src.includes("useAdminResendOrderReceipt")).toBe(true);
    expect(src.includes("useOrderReceiptResendRequests")).toBe(true);
    expect(src.includes("Resend receipt")).toBe(true);
    expect(src.includes("AlertDialog")).toBe(true);
    expect(src.includes('data-testid="order-receipt-resend"')).toBe(true);
    // 44px touch target on the Resend button.
    expect(/min-h-\[44px\]/.test(src)).toBe(true);
  });

  it("mutation hook only sends { order_id, reason } to the edge fn", async () => {
    const hook = await bunGlobal.file(RESENDS_HOOK_PATH).text();
    expect(hook.includes("v2-admin-resend-order-receipt")).toBe(true);
    // Strip line/block comments before scanning for override keys.
    const code = hook
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//") && !l.trim().startsWith("/**"))
      .join("\n");
    expect(code.includes("order_id: orderId")).toBe(true);
    expect(code.includes("reason: trimmed")).toBe(true);
    // No client-supplied overrides in the invoke body.
    for (const forbidden of ["email:", "amount:", "items:", "recipient:", "to:"]) {
      expect(code.includes(forbidden)).toBe(false);
    }
    // Read side is via authenticated select gated by admin RLS; no rpc.
    expect(code.includes(".rpc(")).toBe(false);
  });

  it("blocker doc reflects the new separate-request architecture", async () => {
    const doc = await bunGlobal.file(BLOCKER_DOC).text();
    expect(doc.includes("v2_order_receipt_resend_requests")).toBe(true);
    expect(doc.includes("receiptResendIdempotencyKey")).toBe(true);
    // Old-blocker phrasing must be gone.
    expect(doc.includes("do not create `v2-admin-resend-order-receipt`")).toBe(false);
  });

  it("edge function exists and rejects client overrides", async () => {
    const idx = await bunGlobal.file(FN_INDEX).text();
    expect(idx.includes("Deno.serve")).toBe(true);
    expect(idx.includes("v2_internal_create_receipt_resend_request")).toBe(true);
    expect(idx.includes("receiptResendIdempotencyKey")).toBe(true);
    // No client-supplied overrides accepted.
    for (const forbidden of ["body.email", "body.amount", "body.items", "body.recipient"]) {
      expect(idx.includes(forbidden)).toBe(false);
    }
    const decisions = await bunGlobal.file(FN_DECISIONS).text();
    // Strict allowlist of body fields.
    expect(decisions.includes('new Set(["order_id", "reason"])')).toBe(true);
  });
});
