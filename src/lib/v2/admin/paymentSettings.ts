// Pure presentation helpers for the Admin V2 Payments settings page.
// No side effects. No secret values may pass through these helpers.

export type PaymentSettingsStatus = {
  provider: "upayments";
  enabled: boolean;
  configured: boolean;
  environment: "sandbox" | "production" | "invalid_or_unset";
  api_token_configured: boolean;
  public_site_url_configured: boolean;
  public_site_url: string | null;
  currency: "KWD";
  recurring_billing: boolean;
  services: readonly string[];
};

export type PaymentSettingsSummary = {
  provider: "upayments";
  period: "all_time";
  as_of: string;
  orders: {
    total: number; paid: number; failed: number; pending: number;
    refunded: number; partially_refunded: number; cancelled: number;
  };
  payment_attempts: {
    total: number; verified_paid: number; failed: number; mismatch: number;
  };
  payment_events: { total: number; last_event_at: string | null };
  refunds: { total: number; processed: number };
};

export type StatusTone = "ok" | "warn" | "info" | "danger";

export type ReadinessRow = {
  key: string;
  label: string;
  value: string;
  tone: StatusTone;
};

export function environmentLabel(
  env: PaymentSettingsStatus["environment"],
): { text: string; tone: StatusTone } {
  if (env === "production") return { text: "Production", tone: "ok" };
  if (env === "sandbox") return { text: "Sandbox", tone: "warn" };
  return { text: "Invalid / unset", tone: "danger" };
}

export function readinessRows(status: PaymentSettingsStatus): ReadinessRow[] {
  return [
    {
      key: "enabled",
      label: "Provider enabled",
      value: status.enabled ? "Enabled" : "Disabled",
      tone: status.enabled ? "ok" : "warn",
    },
    {
      key: "configured",
      label: "Configuration ready",
      value: status.configured ? "Ready" : "Not ready",
      tone: status.configured ? "ok" : "warn",
    },
    {
      key: "environment",
      label: "Environment",
      ...(() => {
        const e = environmentLabel(status.environment);
        return { value: e.text, tone: e.tone };
      })(),
    },
    {
      key: "api_token",
      label: "API token",
      value: status.api_token_configured ? "Present" : "Missing",
      tone: status.api_token_configured ? "ok" : "danger",
    },
    {
      key: "public_site_url",
      label: "Public site URL",
      value: status.public_site_url_configured
        ? (status.public_site_url ?? "Configured")
        : "Missing / not allowlisted",
      tone: status.public_site_url_configured ? "ok" : "danger",
    },
    {
      key: "currency",
      label: "Currency",
      value: `${status.currency} (authoritative in fils)`,
      tone: "info",
    },
    {
      key: "recurring",
      label: "Recurring billing",
      value: status.recurring_billing ? "Enabled" : "Disabled (one-time only)",
      tone: "info",
    },
  ];
}

export function periodLabel(period: PaymentSettingsSummary["period"]): string {
  return period === "all_time" ? "All time" : period;
}

// Sum of attention findings from the shared reconciliation summary. Zero =
// healthy; any nonzero total means an admin should investigate. Missing/invalid
// input yields null (unknown) rather than a fake zero.
export function attentionTotal(summary: unknown): number | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  const keys = [
    "mismatches",
    "pending_past_due",
    "paid_without_entitlement",
    "credit_inconsistent",
    "duplicate_event_risk",
    "refund_alloc_over_item",
    "refund_alloc_over_order",
    "processed_missing_credit",
    "processed_item_unrevoked_entitlement",
    "threshold_lifetime_below_credit",
  ] as const;
  let total = 0;
  for (const k of keys) {
    const v = s[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
    total += v;
  }
  return total;
}

export function isHealthy(total: number | null): boolean {
  return total === 0;
}

// The frontend contract must not surface secret-like fields. Callers can use
// this helper to defensively strip any unknown property before render.
const ALLOWED_STATUS_KEYS = new Set([
  "provider", "enabled", "configured", "environment",
  "api_token_configured", "public_site_url_configured", "public_site_url",
  "currency", "recurring_billing", "services",
]);
const FORBIDDEN_STATUS_KEYS = new Set([
  "api_token", "token", "secret", "api_key", "apikey",
  "service_role_key", "anon_key", "raw_env",
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
