import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import {
  AUTH_SENDER_DOMAIN,
  TRANSACTIONAL_DOMAIN,
  normalizeEmailDomainVerification,
  recoveryEmailReadiness,
} from "./emailDomainVerification";

const FN_SOURCE = readFileSync(
  "supabase/functions/v2-admin-email-domain-verification/index.ts",
  "utf8",
);

function payload(
  authStatus: string,
  transactionalStatus: string,
  checked = true,
) {
  return {
    provider: "resend",
    checked,
    domains: [
      { domain: TRANSACTIONAL_DOMAIN, role: "transactional", status: transactionalStatus },
      { domain: AUTH_SENDER_DOMAIN, role: "auth_sender", status: authStatus },
    ],
    recommended_auth_sender: null,
  };
}

describe("email domain verification normalizer", () => {
  it("accepts a well-formed payload and derives readiness flags", () => {
    const out = normalizeEmailDomainVerification(payload("not_found", "verified"));
    expect(out).not.toBeNull();
    expect(out!.transactional_sender_ready).toBe(true);
    expect(out!.auth_sender_ready).toBe(false);
  });

  it("rejects payloads carrying credential-like keys", () => {
    const bad = { ...payload("verified", "verified"), api_key: "re_live" };
    expect(normalizeEmailDomainVerification(bad)).toBeNull();
  });

  it("rejects unknown statuses and roles", () => {
    expect(normalizeEmailDomainVerification(payload("totally-fine", "verified"))).toBeNull();
    expect(
      normalizeEmailDomainVerification({
        provider: "resend",
        checked: true,
        domains: [{ domain: "x.com", role: "marketing", status: "verified" }],
        recommended_auth_sender: null,
      }),
    ).toBeNull();
  });
});

describe("recovery email readiness (fail-closed)", () => {
  it("is not ready when the probe has not run", () => {
    const verdict = recoveryEmailReadiness(null);
    expect(verdict.ready).toBe(false);
    expect(verdict.reason).toBe("not_checked");
  });

  it("is not ready when the probe reports checked=false", () => {
    const out = normalizeEmailDomainVerification(payload("verified", "verified", false));
    expect(recoveryEmailReadiness(out).ready).toBe(false);
  });

  it("recommends the verified transactional sender when the auth domain is unverified", () => {
    const out = normalizeEmailDomainVerification(payload("not_found", "verified"));
    const verdict = recoveryEmailReadiness(out);
    expect(verdict.ready).toBe(false);
    expect(verdict.reason).toBe("use_verified_transactional_sender");
    expect(verdict.action).toContain(`noreply@${TRANSACTIONAL_DOMAIN}`);
  });

  it("blocks entirely when no sending domain is verified", () => {
    const out = normalizeEmailDomainVerification(payload("failed", "pending"));
    expect(recoveryEmailReadiness(out).reason).toBe("no_verified_sending_domain");
  });

  it("is ready only when the auth sender domain itself is verified", () => {
    const out = normalizeEmailDomainVerification(payload("verified", "verified"));
    const verdict = recoveryEmailReadiness(out);
    expect(verdict.ready).toBe(true);
    expect(verdict.reason).toBe("auth_sender_verified");
  });
});

describe("v2-admin-email-domain-verification edge function source", () => {
  it("is admin-gated and POST-only", () => {
    expect(FN_SOURCE).toContain("requireAdmin");
    expect(FN_SOURCE).toContain('methodGuard(req, "POST")');
  });

  it("is read-only against Resend", () => {
    expect(FN_SOURCE).toContain("https://api.resend.com/domains");
    expect(FN_SOURCE).not.toContain("api.resend.com/emails");
    expect(FN_SOURCE).not.toContain('method: "POST"\n      headers');
    expect(FN_SOURCE).not.toContain("DELETE");
  });

  it("never returns the provider key or key metadata", () => {
    expect(FN_SOURCE).not.toContain("api_key:");
    expect(FN_SOURCE).not.toContain("apiKey.length");
    expect(FN_SOURCE).not.toContain("apiKey.slice");
    expect(FN_SOURCE).not.toContain("resend_api_key:");
  });

  it("checks both the transactional and auth sender domains", () => {
    expect(FN_SOURCE).toContain('TRANSACTIONAL_DOMAIN = "jojoprompts.com"');
    expect(FN_SOURCE).toContain('AUTH_SENDER_DOMAIN = "noreply.jojoprompts.com"');
  });
});
