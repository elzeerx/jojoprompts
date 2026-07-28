/**
 * Order detail operational-truth contract.
 *
 * Guards against three specific regressions the release audit called out:
 *   1. The order detail drawer must render receipt-delivery status.
 *   2. It must NOT ship a "Resend receipt" action while the shared claim
 *      RPC still refuses to re-claim `sent` rows — the blocker is
 *      documented in docs/security/RECEIPT_RESEND_BLOCKER.md.
 *   3. It must NOT invoke any `v2-admin-resend-order-receipt` edge
 *      function from the client, and no such function may exist in the
 *      repository until (1)+(2)+(3) in the blocker doc are addressed.
 */
import { describe, it, expect } from "bun:test";

const bunGlobal = (globalThis as unknown as {
  Bun: {
    file: (p: string) => { text: () => Promise<string>; exists: () => Promise<boolean> };
    spawnSync: (opts: { cmd: string[] }) => { stdout: Uint8Array };
  };
}).Bun;

const SHEET_PATH = "src/pages/admin/sections/orders/OrderDetailSheet.tsx";
const HOOK_PATH = "src/hooks/admin/v2/useOrderReceiptDelivery.ts";
const BLOCKER_DOC = "docs/security/RECEIPT_RESEND_BLOCKER.md";
const RESEND_FN_DIR = "supabase/functions/v2-admin-resend-order-receipt";

describe("OrderDetailSheet operational truth", () => {
  it("renders a Receipt delivery section", async () => {
    const src = await bunGlobal.file(SHEET_PATH).text();
    expect(src.includes("Receipt delivery")).toBe(true);
    expect(src.includes("data-testid=\"order-receipt-delivery\"")).toBe(true);
  });

  it("uses the admin receipt-delivery read hook (no writes)", async () => {
    const src = await bunGlobal.file(SHEET_PATH).text();
    expect(src.includes("useOrderReceiptDelivery")).toBe(true);

    const hook = await bunGlobal.file(HOOK_PATH).text();
    // Read-only: no insert / update / upsert / delete / rpc calls.
    for (const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("]) {
      expect(hook.includes(forbidden)).toBe(false);
    }
  });

  it("does NOT expose an admin resend control", async () => {
    const src = await bunGlobal.file(SHEET_PATH).text();
    // No button label, no invoke, no rpc towards the resend function.
    expect(/Resend receipt|resend_receipt|v2-admin-resend-order-receipt/.test(src)).toBe(false);
  });

  it("no client code invokes the (not-yet-shipped) resend function", async () => {
    // Search all source-managed client code.
    const proc = bunGlobal.spawnSync({
      cmd: [
        "rg",
        "-n",
        "--no-heading",
        "-g",
        "!**/OrderDetailSheet.operationalTruth.test.ts",
        "v2-admin-resend-order-receipt",
        "src",
      ],
    });
    const stdout = new TextDecoder().decode(proc.stdout);
    expect(stdout.trim()).toBe("");
  });

  it("has no `v2-admin-resend-order-receipt` edge function directory", async () => {
    const exists = await bunGlobal.file(RESEND_FN_DIR + "/index.ts").exists();
    expect(exists).toBe(false);
  });

  it("blocker note explains why the resend action is absent", async () => {
    const doc = await bunGlobal.file(BLOCKER_DOC).text();
    expect(doc.includes("v2_claim_order_receipt_delivery")).toBe(true);
    expect(doc.includes("do not create `v2-admin-resend-order-receipt`")).toBe(true);
  });
});
