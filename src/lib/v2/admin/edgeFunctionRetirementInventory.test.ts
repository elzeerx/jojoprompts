import { describe, it, expect } from "bun:test";
declare const require: (m: string) => any;
const { readFileSync } = require("fs");
import {
  EDGE_FUNCTION_AUDIT,
  EDGE_FUNCTION_AUDIT_DATE,
  ALREADY_410_SLUGS,
  PREEXISTING_410_SLUGS,
  RECOMMENDED_RETIREMENTS,
  RECOMMENDED_HARDENING,
  REQUIRES_INVESTIGATION,
  LIVE_RETIREMENT_SLUGS,
  PENDING_RETIREMENT_SLUGS,
  RETIREMENT_SLUGS,
} from "./edgeFunctionRetirementInventory";

/**
 * Live Supabase inventory snapshot refreshed 2026-07-29.
 * T=verify_jwt true, F=false.
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

  it("every live 410 entry is represented and marked already410Live", () => {
    for (const slug of ALREADY_410_SLUGS) {
      const entry = EDGE_FUNCTION_AUDIT.find((e) => e.name === slug);
      expect(Boolean(entry)).toBe(true);
      expect(entry!.already410Live).toBe(true);
      if (
        PREEXISTING_410_SLUGS.includes(
          slug as (typeof PREEXISTING_410_SLUGS)[number],
        )
      ) {
        expect(entry!.classification).toBe("already_410");
      } else {
        expect(entry!.classification).toBe("legacy_unreachable");
      }
    }
  });

  it("debug-environment is a verified live retirement", () => {
    const debug = EDGE_FUNCTION_AUDIT.find((e) => e.name === "debug-environment")!;
    expect(debug.disposition).toBe("retire_to_410");
    expect(debug.recommendedRetirementAppliedLive).toBe(true);
    expect(debug.already410Live).toBe(true);
    expect(debug.evidence).toMatch(/version 326|verified|410/i);
  });

  it("only the 24 verified retirements are marked applied live", () => {
    for (const e of EDGE_FUNCTION_AUDIT) {
      expect(e.recommendedRetirementAppliedLive).toBe(
        LIVE_RETIREMENT_SLUGS.includes(
          e.name as (typeof LIVE_RETIREMENT_SLUGS)[number],
        ),
      );
    }
  });

  it("already410Live is exactly the 10 pre-existing plus 24 verified retirements", () => {
    const trueSet = new Set(
      EDGE_FUNCTION_AUDIT.filter((e) => e.already410Live).map((e) => e.name),
    );
    expect(trueSet).toEqual(new Set(ALREADY_410_SLUGS));
    expect(PREEXISTING_410_SLUGS.length).toBe(10);
    expect(ALREADY_410_SLUGS.length).toBe(34);
  });

  it("audit date reflects the live 2026-07-29 verification", () => {
    expect(EDGE_FUNCTION_AUDIT_DATE).toBe("2026-07-29");
  });

  it("recommended retirement set is 24 live plus one source-only retirement", () => {
    expect(new Set(RECOMMENDED_RETIREMENTS)).toEqual(new Set(RETIREMENT_SLUGS));
    expect(LIVE_RETIREMENT_SLUGS.length).toBe(24);
    expect(PENDING_RETIREMENT_SLUGS).toEqual(["magic-login"]);
    expect(RECOMMENDED_RETIREMENTS.length).toBe(25);
    const magic = EDGE_FUNCTION_AUDIT.find((e) => e.name === "magic-login")!;
    expect(magic.recommendedRetirementAppliedLive).toBe(false);
    expect(magic.already410Live).toBe(false);
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

  it("all previously-open hardening entries are resolved", () => {
    expect(RECOMMENDED_HARDENING).toEqual([]);
    const byName = new Map(EDGE_FUNCTION_AUDIT.map((e) => [e.name, e]));
    expect(byName.get("mcp")!.authMechanism).toBe("platform_jwt");
    expect(byName.get("delete-my-account")!.authMechanism).toBe("custom_user_jwt");
  });

  it("docs report 24 retirements live, one pending, and 0 investigate remaining", () => {
    expect(DOC).toMatch(/24/);
    expect(DOC).toMatch(/verified live|live verification/i);
    expect(DOC).toMatch(/magic-login/);
    expect(DOC).toMatch(/source-only|pending/i);
    expect(/\b9 slugs\b/.test(DOC)).toBe(false);
    expect(/unknown\s*\/\s*investigate:\s*10/i.test(DOC)).toBe(false);
    expect(/three PRs|3 PRs/i.test(DOC)).toBe(false);
    expect(DOC.includes("#release")).toBe(false);
  });

  it("docs mention debug-environment live version 326 verification", () => {
    expect(DOC).toMatch(/version \*\*326\*\*|version 326/i);
    expect(DOC).toMatch(/debug-environment/);
  });

  it("docs flag recover-orphaned-payments as confirmed critical exposure", () => {
    expect(DOC).toMatch(/recover-orphaned-payments/);
    expect(DOC.toLowerCase()).toMatch(/critical/);
  });
});
