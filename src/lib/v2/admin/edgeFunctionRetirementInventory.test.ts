import { describe, it, expect } from "bun:test";
declare const require: (m: string) => any;
const { readFileSync } = require("fs");
import {
  EDGE_FUNCTION_AUDIT,
  EDGE_FUNCTION_AUDIT_DATE,
  ALREADY_410_SLUGS,
  RECOMMENDED_RETIREMENTS,
  RECOMMENDED_HARDENING,
  REQUIRES_INVESTIGATION,
  RETIREMENT_SLUGS,
} from "./edgeFunctionRetirementInventory";

/**
 * Live Supabase inventory snapshot (2026-07-28). T=verify_jwt true, F=false.
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

const DOC = readFileSync(
  "docs/security/EDGE_FUNCTION_AUDIT_2026-07-28.md",
  "utf8",
);

describe("Edge Function retirement inventory", () => {
  it("contains exactly 68 unique live function names", () => {
    expect(EDGE_FUNCTION_AUDIT.length).toBe(68);
    expect(new Set(EDGE_FUNCTION_AUDIT.map((e) => e.name)).size).toBe(68);
  });

  it("names match the live Supabase inventory 1:1", () => {
    const inv = new Set(EDGE_FUNCTION_AUDIT.map((e) => e.name));
    const live = new Set(Object.keys(LIVE_VERIFY_JWT));
    expect([...live].filter((n) => !inv.has(n))).toEqual([]);
    expect([...inv].filter((n) => !live.has(n))).toEqual([]);
  });

  it("every entry's verify_jwt flag matches live", () => {
    for (const entry of EDGE_FUNCTION_AUDIT) {
      expect(entry.verifyJwt).toBe(LIVE_VERIFY_JWT[entry.name]);
    }
  });

  it("classification/disposition enums are valid", () => {
    for (const e of EDGE_FUNCTION_AUDIT) {
      expect(VALID_CLASSIFICATIONS.has(e.classification)).toBe(true);
      expect(VALID_DISPOSITIONS.has(e.disposition)).toBe(true);
    }
  });

  it("classification/disposition combinations are internally consistent", () => {
    for (const e of EDGE_FUNCTION_AUDIT) {
      if (e.classification === "already_410") expect(e.disposition).toBe("keep");
      if (e.disposition === "retire_to_410") expect(e.classification).toBe("legacy_unreachable");
      if (e.classification === "legacy_unreachable") expect(e.disposition).toBe("retire_to_410");
    }
  });

  it("every ALREADY_410_SLUGS entry is represented and marked already410Live", () => {
    for (const slug of ALREADY_410_SLUGS) {
      const entry = EDGE_FUNCTION_AUDIT.find((e) => e.name === slug);
      expect(Boolean(entry)).toBe(true);
      expect(entry!.classification).toBe("already_410");
      expect(entry!.already410Live).toBe(true);
    }
  });

  it("debug-environment is retire_to_410 with concrete evidence", () => {
    const debug = EDGE_FUNCTION_AUDIT.find((e) => e.name === "debug-environment")!;
    expect(debug.disposition).toBe("retire_to_410");
    expect(debug.evidence).toMatch(/318|320|source-first|deploy/i);
  });

  it("recommendedRetirementAppliedLive is false for every entry", () => {
    for (const e of EDGE_FUNCTION_AUDIT) {
      expect(e.recommendedRetirementAppliedLive).toBe(false);
    }
  });

  it("already410Live is only true for the ALREADY_410_SLUGS set", () => {
    const trueSet = new Set(
      EDGE_FUNCTION_AUDIT.filter((e) => e.already410Live).map((e) => e.name),
    );
    expect(trueSet).toEqual(new Set(ALREADY_410_SLUGS));
  });

  it("audit date is 2026-07-28", () => {
    expect(EDGE_FUNCTION_AUDIT_DATE).toBe("2026-07-28");
  });

  it("recommended retirement set is exactly the 23 route-graph-resolved slugs", () => {
    expect(new Set(RECOMMENDED_RETIREMENTS)).toEqual(new Set(RETIREMENT_SLUGS));
    expect(RECOMMENDED_RETIREMENTS.length).toBe(23);
  });

  it("investigation set is empty after the route-graph pass", () => {
    expect(REQUIRES_INVESTIGATION).toEqual([]);
  });

  it("retirement set does NOT include any reachable admin/auth/user surface", () => {
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
      "admin-package-upload",
      "resend-payment-email",
      "admin-bulk-confirm-users",
    ];
    for (const slug of mustNotRetire) {
      expect(RECOMMENDED_RETIREMENTS.includes(slug)).toBe(false);
    }
  });

  it("auth mechanism corrections are recorded", () => {
    const byName = new Map(EDGE_FUNCTION_AUDIT.map((e) => [e.name, e]));
    expect(byName.get("get-image")!.authMechanism).toBe("published_resource_allowlist");
    expect(byName.get("resource-download")!.authMechanism).toBe("custom_user_jwt");
    expect(byName.get("v2-upayments-checkout")!.authMechanism).toBe("custom_user_jwt");
    expect(byName.get("v2-upayments-status")!.authMechanism).toBe("custom_user_jwt");
    expect(byName.get("v2-upayments-webhook")!.authMechanism).toBe("provider_status_reconciliation");
  });

  it("v2-upayments-webhook is NOT claimed to verify a provider signature", () => {
    const wh = EDGE_FUNCTION_AUDIT.find((e) => e.name === "v2-upayments-webhook")!;
    expect(wh.authMechanism === "provider_signature").toBe(false);
    expect(/signature-verified|verifies (a )?signature/.test(wh.evidence.toLowerCase())).toBe(false);
    expect(wh.callers.some((c) => c.includes("SimpleUpayButton"))).toBe(false);
  });

  it("hardening set count matches doc-declared 8", () => {
    expect(RECOMMENDED_HARDENING.length).toBeGreaterThanOrEqual(8);
  });

  it("docs report exact 23 retirements and 0 investigate remaining", () => {
    expect(DOC).toMatch(/23 slugs/);
    expect(/\b9 slugs\b/.test(DOC)).toBe(false);
    expect(/unknown\s*\/\s*investigate:\s*10/i.test(DOC)).toBe(false);
    expect(/three PRs|3 PRs/i.test(DOC)).toBe(false);
    expect(DOC.includes("#release")).toBe(false);
  });

  it("docs mention debug-environment version 318/320 source/deploy sync warning", () => {
    expect(DOC).toMatch(/318/);
    expect(DOC).toMatch(/320/);
  });

  it("docs flag recover-orphaned-payments as confirmed critical exposure", () => {
    expect(DOC).toMatch(/recover-orphaned-payments/);
    expect(DOC.toLowerCase()).toMatch(/critical/);
  });
});
