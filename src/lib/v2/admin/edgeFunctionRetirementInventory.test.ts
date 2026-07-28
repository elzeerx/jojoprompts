import { describe, it, expect } from "bun:test";
import {
  EDGE_FUNCTION_AUDIT,
  EDGE_FUNCTION_AUDIT_DATE,
  ALREADY_410_SLUGS,
  RECOMMENDED_RETIREMENTS,
} from "./edgeFunctionRetirementInventory";

/**
 * Live Supabase inventory snapshot (2026-07-28). T=verify_jwt true, F=false.
 * This constant is the authoritative comparison anchor for the audit.
 */
const LIVE_VERIFY_JWT: Record<string, boolean> = {
  "generate-metadata": true,
  "suggest-prompt": false,
  "get-all-users": true,
  "get-image": false,
  "create-subscription": false,
  "cancel-subscription": false,
  "validate-file-upload": false,
  "get-paypal-client-id": false,
  "process-paypal-payment": false,
  "verify-paypal-payment": false,
  "recover-orphaned-payments": false,
  "paypal-webhook": false,
  "get-transaction-by-order": false,
  "delete-my-account": false,
  "send-email": false,
  "get-admin-transactions": false,
  "generate-use-case": true,
  "resend-confirmation-email": false,
  "auto-capture-paypal": false,
  "scheduled-payment-cleanup": false,
  "debug-environment": false,
  "resend-confirmation-alternative": true,
  "send-signup-confirmation": false,
  "track-email-engagement": false,
  "enhance-prompt": false,
  "send-email-confirmation-reminder": false,
  "send-purchase-confirmation": false,
  "get-users-without-plans": true,
  "send-bulk-plan-reminders": true,
  "send-plan-reminder": true,
  "generate-magic-link": false,
  "magic-login": false,
  "get-user-insights": false,
  "smart-unsubscribe": false,
  "ai-gpt5-metaprompt": false,
  "ai-json-spec": false,
  "translate-prompt": true,
  "translate-text": false,
  "auto-generate-prompt": false,
  "validate-signup": false,
  "admin-users-v2": true,
  "resend-payment-email": true,
  "admin-bulk-confirm-users": true,
  "check-email-exists": false,
  "process-upayments-payment": false,
  "upayments-webhook": false,
  "send-abandoned-cart-email": true,
  "send-password-reset": false,
  "verify-password-reset": false,
  "ai-studio-chat": true,
  "ai-studio-image": true,
  "mcp": false,
  "resource-download": false,
  "admin-package-upload": false,
  "v2-upayments-checkout": false,
  "v2-upayments-refund": false,
  "v2-upayments-status": false,
  "v2-upayments-webhook": false,
  "submit-contact": false,
  "v2-admin-upload-resource-file": true,
  "v2-admin-package-scan-control": true,
  "v2-package-scan-worker": false,
  "v2-qa-one-time-package-upload": false,
  "v2-admin-payment-settings-status": true,
  "v2-admin-email-settings-status": true,
  "v2-admin-storage-settings-status": true,
  "v2-admin-integrations-settings-status": true,
  "v2-admin-roles-settings-status": true,
};

const VALID_CLASSIFICATIONS = new Set([
  "required_v2",
  "required_shared_account_auth",
  "legacy_unreachable",
  "already_410",
  "unknown_review",
]);
const VALID_DISPOSITIONS = new Set([
  "keep",
  "harden",
  "retire_to_410",
  "investigate",
]);

describe("Edge Function retirement inventory", () => {
  it("contains exactly 68 unique live function names", () => {
    expect(EDGE_FUNCTION_AUDIT.length).toBe(68);
    const names = new Set(EDGE_FUNCTION_AUDIT.map((e) => e.name));
    expect(names.size).toBe(68);
  });

  it("names exactly match the live Supabase inventory (no source-only / live-only drift)", () => {
    const inv = new Set(EDGE_FUNCTION_AUDIT.map((e) => e.name));
    const live = new Set(Object.keys(LIVE_VERIFY_JWT));
    const missing = [...live].filter((n) => !inv.has(n));
    const extra = [...inv].filter((n) => !live.has(n));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it("every entry's verify_jwt flag matches the live inventory", () => {
    for (const entry of EDGE_FUNCTION_AUDIT) {
      expect(entry.verifyJwt).toBe(LIVE_VERIFY_JWT[entry.name]);
    }
  });

  it("classification and disposition are drawn from the allowed enums", () => {
    for (const e of EDGE_FUNCTION_AUDIT) {
      expect(VALID_CLASSIFICATIONS.has(e.classification)).toBe(true);
      expect(VALID_DISPOSITIONS.has(e.disposition)).toBe(true);
    }
  });

  it("classification/disposition combinations are internally consistent", () => {
    for (const e of EDGE_FUNCTION_AUDIT) {
      if (e.classification === "already_410") {
        // 410 stubs should be kept (already retired); never retire_to_410 again.
        expect(e.disposition).toBe("keep");
      }
      if (e.disposition === "retire_to_410") {
        expect(e.classification).toBe("legacy_unreachable");
      }
      if (e.classification === "legacy_unreachable") {
        expect(e.disposition).toBe("retire_to_410");
      }
    }
  });

  it("every ALREADY_410_SLUGS entry is represented and classified already_410", () => {
    for (const slug of ALREADY_410_SLUGS) {
      const entry = EDGE_FUNCTION_AUDIT.find((e) => e.name === slug);
      expect(Boolean(entry)).toBe(true);
      expect(entry!.classification).toBe("already_410");
    }
  });

  it("debug-environment is never classified as 'keep' without explicit hardening/retirement", () => {
    const debug = EDGE_FUNCTION_AUDIT.find((e) => e.name === "debug-environment");
    expect(Boolean(debug)).toBe(true);
    expect(debug!.disposition === "harden" || debug!.disposition === "retire_to_410")
      .toBe(true);
    expect(debug!.evidence.length).toBeGreaterThan(20);
  });

  it("appliedLive is false for every entry (no retirement has shipped yet)", () => {
    for (const e of EDGE_FUNCTION_AUDIT) {
      expect(e.appliedLive).toBe(false);
    }
  });

  it("audit date is the documented 2026-07-28 snapshot", () => {
    expect(EDGE_FUNCTION_AUDIT_DATE).toBe("2026-07-28");
  });

  it("recommended retirement set is bounded and excludes any admin/auth surface still reachable", () => {
    // These slugs have active callers in src/ and must NOT appear in the retirement set.
    const mustNotRetire = [
      "get-all-users",
      "delete-my-account",
      "send-email",
      "smart-unsubscribe",
      "magic-login",
      "submit-contact",
      "resource-download",
      "v2-upayments-checkout",
      "v2-upayments-status",
      "v2-upayments-webhook",
      "v2-upayments-refund",
      "v2-package-scan-worker",
      "v2-admin-upload-resource-file",
      "generate-metadata",
      "generate-use-case",
      "translate-prompt",
      "ai-studio-chat",
      "ai-studio-image",
    ];
    for (const slug of mustNotRetire) {
      expect(RECOMMENDED_RETIREMENTS.includes(slug)).toBe(false);
    }
  });
});
