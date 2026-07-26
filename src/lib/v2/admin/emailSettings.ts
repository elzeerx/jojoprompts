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
