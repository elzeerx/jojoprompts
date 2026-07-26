// Pure presentation helpers for the Admin V2 Email settings page. No side
// effects. Secret values must never pass through these helpers.

export type EmailSettingsStatus = {
  provider: "resend";
  transport: "edge_functions";
  configured: boolean;
  provider_api_key_configured: boolean;
  sender_name: string;
  sender_address: string;
  reply_to: string;
  domain: string;
  provider_health_check: "not_checked";
  domain_verification: "not_checked";
  auth_email_transport: "separate_not_checked";
  primary_service: string;
  services: readonly string[];
};

export type EmailSettingsSummary = {
  provider: "resend";
  window: "24h";
  as_of: string;
  delivery: {
    attempts: number;
    sent: number;
    failed: number;
    blocked: number;
    last_event_at: string | null;
  };
  templates: {
    active: number;
    inactive: number;
  };
};

export type StatusTone = "ok" | "warn" | "info" | "danger";

export type ReadinessRow = {
  key: string;
  label: string;
  value: string;
  tone: StatusTone;
};

export function readinessRows(status: EmailSettingsStatus): ReadinessRow[] {
  return [
    {
      key: "provider",
      label: "Provider",
      value: "Resend",
      tone: "info",
    },
    {
      key: "transport",
      label: "Transport",
      value: "Supabase Edge Functions",
      tone: "info",
    },
    {
      key: "configured",
      label: "Configuration ready",
      value: status.configured ? "Ready" : "Not ready",
      tone: status.configured ? "ok" : "warn",
    },
    {
      key: "api_key",
      label: "Provider API key",
      value: status.provider_api_key_configured ? "Present" : "Missing",
      tone: status.provider_api_key_configured ? "ok" : "danger",
    },
    {
      key: "sender",
      label: "Sender identity",
      value: `${status.sender_name} <${status.sender_address}>`,
      tone: "info",
    },
    {
      key: "reply_to",
      label: "Reply-to",
      value: status.reply_to,
      tone: "info",
    },
    {
      key: "primary_service",
      label: "Primary service",
      value: status.primary_service,
      tone: "info",
    },
  ];
}

export type BoundaryRow = {
  key: string;
  label: string;
  value: string;
  tone: StatusTone;
};

export function boundaryRows(status: EmailSettingsStatus): BoundaryRow[] {
  const notChecked = "Not checked here";
  return [
    {
      key: "provider_health",
      label: "Resend uptime / API health",
      value: notChecked,
      tone: "info",
    },
    {
      key: "domain_verification",
      label: `DKIM / SPF / DNS for ${status.domain}`,
      value: notChecked,
      tone: "info",
    },
    {
      key: "auth_email_transport",
      label: "Supabase Auth email (SMTP)",
      value: "Managed separately by Supabase Auth",
      tone: "info",
    },
  ];
}

// Success rate as a fraction 0..1, or null when there is no denominator.
export function successRate(
  summary: Pick<EmailSettingsSummary["delivery"], "attempts" | "sent"> | null | undefined,
): number | null {
  if (!summary) return null;
  const { attempts, sent } = summary;
  if (typeof attempts !== "number" || typeof sent !== "number") return null;
  if (!Number.isFinite(attempts) || !Number.isFinite(sent)) return null;
  if (attempts <= 0) return null;
  const clampedSent = Math.max(0, Math.min(sent, attempts));
  return clampedSent / attempts;
}

export function formatPercent(fraction: number | null): string {
  if (fraction === null) return "—";
  return `${(fraction * 100).toFixed(1)}%`;
}

// Defensive: strip anything not on the frontend contract before render. Any
// unexpected key (including possible future secret-like fields) is dropped.
const ALLOWED_STATUS_KEYS = new Set<string>([
  "provider", "transport", "configured", "provider_api_key_configured",
  "sender_name", "sender_address", "reply_to", "domain",
  "provider_health_check", "domain_verification", "auth_email_transport",
  "primary_service", "services",
]);
const FORBIDDEN_STATUS_KEYS = new Set<string>([
  "api_key", "apikey", "resend_api_key", "token", "secret",
  "service_role_key", "anon_key", "raw_env", "env",
]);

export function stripStatusFields(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (FORBIDDEN_STATUS_KEYS.has(k)) continue;
    if (!ALLOWED_STATUS_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

// Fixed public identity constants; server MUST report these exact values.
const EXPECTED_SENDER_NAME = "JoJo Prompts";
const EXPECTED_SENDER_ADDRESS = "info@jojoprompts.com";
const EXPECTED_REPLY_TO = "info@jojoprompts.com";
const EXPECTED_DOMAIN = "jojoprompts.com";

function isBool(v: unknown): v is boolean { return typeof v === "boolean"; }
function isStr(v: unknown, expected?: string): v is string {
  return typeof v === "string" && (expected === undefined || v === expected);
}

/**
 * Strict runtime validator for the edge status payload. Returns null on any
 * malformed field so hooks can surface a generic error and never leak partial
 * or attacker-controlled fields.
 */
export function normalizeEmailSettingsStatus(
  input: unknown,
): EmailSettingsStatus | null {
  const stripped = stripStatusFields(input);
  if (!isStr(stripped.provider, "resend")) return null;
  if (!isStr(stripped.transport, "edge_functions")) return null;
  if (!isBool(stripped.configured)) return null;
  if (!isBool(stripped.provider_api_key_configured)) return null;
  if (!isStr(stripped.sender_name, EXPECTED_SENDER_NAME)) return null;
  if (!isStr(stripped.sender_address, EXPECTED_SENDER_ADDRESS)) return null;
  if (!isStr(stripped.reply_to, EXPECTED_REPLY_TO)) return null;
  if (!isStr(stripped.domain, EXPECTED_DOMAIN)) return null;
  if (!isStr(stripped.provider_health_check, "not_checked")) return null;
  if (!isStr(stripped.domain_verification, "not_checked")) return null;
  if (!isStr(stripped.auth_email_transport, "separate_not_checked")) return null;
  if (!isStr(stripped.primary_service, "send-email")) return null;
  if (!Array.isArray(stripped.services)) return null;
  // Must be exactly ["send-email"] once every entry is a trimmed non-empty
  // string. Reject anything else so we don't render fabricated service names.
  const services = stripped.services
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (services.length !== 1 || services[0] !== "send-email") return null;
  return {
    provider: "resend",
    transport: "edge_functions",
    configured: stripped.configured,
    provider_api_key_configured: stripped.provider_api_key_configured,
    sender_name: EXPECTED_SENDER_NAME,
    sender_address: EXPECTED_SENDER_ADDRESS,
    reply_to: EXPECTED_REPLY_TO,
    domain: EXPECTED_DOMAIN,
    provider_health_check: "not_checked",
    domain_verification: "not_checked",
    auth_email_transport: "separate_not_checked",
    primary_service: "send-email",
    services: ["send-email"],
  };
}

function toNonNegInt(v: unknown): number | null {
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return null;
    return v;
  }
  if (typeof v === "string" && /^\d+$/.test(v)) {
    const n = Number(v);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  }
  return null;
}

function parseIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return null;
  return v;
}

/**
 * Strict runtime validator for the aggregate summary RPC. Guarantees the
 * three delivery buckets are disjoint and never exceed attempts.
 */
export function normalizeEmailSettingsSummary(
  input: unknown,
): EmailSettingsSummary | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (raw.provider !== "resend") return null;
  if (raw.window !== "24h") return null;
  const asOf = parseIsoOrNull(raw.as_of);
  if (!asOf) return null;

  const delivery = raw.delivery as Record<string, unknown> | undefined;
  const templates = raw.templates as Record<string, unknown> | undefined;
  if (!delivery || typeof delivery !== "object") return null;
  if (!templates || typeof templates !== "object") return null;

  const attempts = toNonNegInt(delivery.attempts);
  const sent = toNonNegInt(delivery.sent);
  const failed = toNonNegInt(delivery.failed);
  const blocked = toNonNegInt(delivery.blocked);
  if (attempts === null || sent === null || failed === null || blocked === null) {
    return null;
  }
  // Disjoint buckets must not exceed total attempts.
  if (sent + failed + blocked > attempts) return null;

  const lastEventAt = delivery.last_event_at === null
    ? null
    : parseIsoOrNull(delivery.last_event_at);
  if (delivery.last_event_at !== null && lastEventAt === null) return null;

  const active = toNonNegInt(templates.active);
  const inactive = toNonNegInt(templates.inactive);
  if (active === null || inactive === null) return null;

  return {
    provider: "resend",
    window: "24h",
    as_of: asOf,
    delivery: { attempts, sent, failed, blocked, last_event_at: lastEventAt },
    templates: { active, inactive },
  };
}
