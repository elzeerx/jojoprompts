// Pure helpers for the Resend sending-domain verification probe used to clear
// the password-recovery email blocker (2026-08-02 Auth 500:
// "noreply.jojoprompts.com is not a verified sending domain").
//
// No side effects. Secret values must never pass through these helpers.

export type SenderDomainStatus =
  | "verified"
  | "pending"
  | "failed"
  | "not_found"
  | "unknown";

export type SenderDomainRole = "transactional" | "auth_sender";

export type SenderDomainRow = {
  domain: string;
  role: SenderDomainRole;
  status: SenderDomainStatus;
};

export type EmailDomainVerification = {
  provider: "resend";
  checked: boolean;
  domains: SenderDomainRow[];
  auth_sender_ready: boolean;
  transactional_sender_ready: boolean;
  recommended_auth_sender: string | null;
};

export const TRANSACTIONAL_DOMAIN = "jojoprompts.com";
// 2026-08-03: Supabase Auth SMTP sender was moved to noreply@jojoprompts.com,
// which sits on the already-verified parent domain (Option A remediation).
export const AUTH_SENDER_DOMAIN = "jojoprompts.com";
// Previously configured, never verified in Resend. Kept for evidence/regression.
export const LEGACY_AUTH_SENDER_DOMAIN = "noreply.jojoprompts.com";

const STATUSES = new Set<SenderDomainStatus>([
  "verified", "pending", "failed", "not_found", "unknown",
]);
const ROLES = new Set<SenderDomainRole>(["transactional", "auth_sender"]);

// Anything that could carry credential material is rejected outright.
const FORBIDDEN_KEYS = new Set<string>([
  "api_key", "apikey", "resend_api_key", "token", "secret", "key",
  "service_role_key", "anon_key", "raw_env", "env", "records",
]);

export function normalizeEmailDomainVerification(
  input: unknown,
): EmailDomainVerification | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const rec = input as Record<string, unknown>;
  for (const k of Object.keys(rec)) {
    if (FORBIDDEN_KEYS.has(k)) return null;
  }
  if (rec.provider !== "resend") return null;
  if (typeof rec.checked !== "boolean") return null;
  if (!Array.isArray(rec.domains)) return null;

  const domains: SenderDomainRow[] = [];
  for (const entry of rec.domains) {
    if (!entry || typeof entry !== "object") return null;
    const d = entry as Record<string, unknown>;
    if (typeof d.domain !== "string" || d.domain.trim() === "") return null;
    if (typeof d.role !== "string" || !ROLES.has(d.role as SenderDomainRole)) return null;
    if (typeof d.status !== "string" || !STATUSES.has(d.status as SenderDomainStatus)) {
      return null;
    }
    domains.push({
      domain: d.domain.trim().toLowerCase(),
      role: d.role as SenderDomainRole,
      status: d.status as SenderDomainStatus,
    });
  }

  const authReady = domains.some(
    (d) => d.role === "auth_sender" && d.status === "verified",
  );
  const transactionalReady = domains.some(
    (d) => d.role === "transactional" && d.status === "verified",
  );
  const recommended = rec.recommended_auth_sender;
  if (recommended !== null && typeof recommended !== "string") return null;

  return {
    provider: "resend",
    checked: rec.checked,
    domains,
    auth_sender_ready: authReady,
    transactional_sender_ready: transactionalReady,
    recommended_auth_sender: recommended ?? null,
  };
}

export type RecoveryEmailReadiness = {
  ready: boolean;
  reason:
    | "auth_sender_verified"
    | "use_verified_transactional_sender"
    | "no_verified_sending_domain"
    | "not_checked";
  action: string;
};

/**
 * Fail-closed readiness verdict for password-recovery email delivery.
 * Unknown/unchecked state is never reported as ready.
 */
export function recoveryEmailReadiness(
  status: EmailDomainVerification | null | undefined,
): RecoveryEmailReadiness {
  if (!status || !status.checked) {
    return {
      ready: false,
      reason: "not_checked",
      action:
        "Run the Resend sending-domain check before treating recovery email as working.",
    };
  }
  if (status.auth_sender_ready) {
    return {
      ready: true,
      reason: "auth_sender_verified",
      action: `Supabase Auth SMTP may send from ${AUTH_SENDER_DOMAIN}.`,
    };
  }
  if (status.transactional_sender_ready) {
    return {
      ready: false,
      reason: "use_verified_transactional_sender",
      action:
        `${AUTH_SENDER_DOMAIN} is not verified in Resend. Point Supabase Auth SMTP at ` +
        `noreply@${TRANSACTIONAL_DOMAIN} (verified) or verify ${AUTH_SENDER_DOMAIN} DNS first.`,
    };
  }
  return {
    ready: false,
    reason: "no_verified_sending_domain",
    action:
      "No verified Resend sending domain is available. Verify DNS (SPF/DKIM) before enabling auth email.",
  };
}
