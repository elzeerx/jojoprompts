// Pure presentation + strict runtime validation for Admin V2 Integrations
// settings. Fail-closed: any malformed field, unknown key, secret-like key,
// wrong ID, wrong order, duplicate, extra, or missing integration rejects
// the whole payload.

export type StatusTone = "ok" | "warn" | "danger" | "info";

export const INTEGRATION_ORDER = [
  "upayments",
  "resend",
  "cloudmersive",
  "lovable_ai",
  "jojoprompts_mcp",
] as const;
export type IntegrationId = (typeof INTEGRATION_ORDER)[number];

export const MCP_ENDPOINT =
  "https://fxkqgjakbyrxkmevkglv.supabase.co/functions/v1/mcp";

// Anything matching these substrings anywhere in a returned key is treated as
// a leaked secret and rejects the entire payload.
const SECRET_KEY_PATTERNS = [
  "secret", "token", "api_key", "apikey", "key_value", "credential",
  "password", "bearer", "authorization", "raw_env", "env_value",
] as const;

// Keys we intentionally allow even though the substring "key" or "auth"
// appears in them. They only carry booleans or safe literals.
const SAFE_KEY_ALLOWLIST = new Set<string>([
  "api_key_configured",
  "worker_secret_configured",
  "secret_values",
  "auth",
]);

function keyLooksSecret(key: string): boolean {
  if (SAFE_KEY_ALLOWLIST.has(key)) return false;
  const lc = key.toLowerCase();
  return SECRET_KEY_PATTERNS.some((p) => lc.includes(p));
}

function noSecretKeysDeep(value: unknown, depth = 0): boolean {
  if (depth > 6) return false;
  if (value === null || typeof value !== "object") return true;
  if (Array.isArray(value)) {
    for (const item of value) if (!noSecretKeysDeep(item, depth + 1)) return false;
    return true;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (keyLooksSecret(k)) return false;
    if (!noSecretKeysDeep(v, depth + 1)) return false;
  }
  return true;
}

function isBool(v: unknown): v is boolean { return typeof v === "boolean"; }
// Strict: only canonical ISO-8601 UTC produced by Date.prototype.toISOString().
// Rejects merely parseable strings like "July 26, 2026" or timezone offsets.
const ISO_UTC_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function isIsoString(v: unknown): v is string {
  if (typeof v !== "string") return false;
  if (!ISO_UTC_RE.test(v)) return false;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return false;
  return new Date(t).toISOString() === v;
}

export type UPaymentsIntegration = {
  id: "upayments";
  purpose: "payments";
  enabled: boolean;
  configured: boolean;
  environment: "sandbox" | "production" | "not_configured";
  specialist_route: "/admin/settings/payments";
};

export type ResendIntegration = {
  id: "resend";
  purpose: "transactional_email";
  configured: boolean;
  sender_address: "info@jojoprompts.com";
  domain: "jojoprompts.com";
  specialist_route: "/admin/settings/email";
};

export type CloudmersiveIntegration = {
  id: "cloudmersive";
  purpose: "package_scanning";
  configured: boolean;
  api_key_configured: boolean;
  worker_secret_configured: boolean;
  specialist_route: "/admin/trust/scans";
};

export type LovableAiIntegration = {
  id: "lovable_ai";
  purpose: "ai_studio";
  configured: boolean;
  application_services: readonly ["ai-studio-chat", "ai-studio-image"];
  specialist_route: "/admin/publishing/new";
};

export type McpIntegration = {
  id: "jojoprompts_mcp";
  purpose: "mcp_access";
  configuration_state: "application_contract";
  auth: "supabase_oauth";
  service: "mcp";
  contract_version: "0.1.0";
  tools: readonly ["list_my_prompts"];
  endpoint: typeof MCP_ENDPOINT;
  deployment_status: "not_checked";
};

export type Integration =
  | UPaymentsIntegration
  | ResendIntegration
  | CloudmersiveIntegration
  | LovableAiIntegration
  | McpIntegration;

export type IntegrationsSettingsStatus = {
  as_of: string;
  integrations: readonly [
    UPaymentsIntegration,
    ResendIntegration,
    CloudmersiveIntegration,
    LovableAiIntegration,
    McpIntegration,
  ];
  boundaries: {
    provider_health: "not_checked";
    deployment_status: "not_checked";
    secret_values: "never_exposed";
  };
};

const TOP_ALLOWED = new Set(["as_of", "integrations", "boundaries"]);

function normalizeUpayments(v: unknown): UPaymentsIntegration | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const allowed = new Set([
    "id", "purpose", "enabled", "configured", "environment", "specialist_route",
  ]);
  for (const k of Object.keys(o)) if (!allowed.has(k)) return null;
  if (o.id !== "upayments") return null;
  if (o.purpose !== "payments") return null;
  if (!isBool(o.enabled) || !isBool(o.configured)) return null;
  if (o.environment !== "sandbox" && o.environment !== "production" &&
      o.environment !== "not_configured") return null;
  if (o.specialist_route !== "/admin/settings/payments") return null;
  return {
    id: "upayments", purpose: "payments",
    enabled: o.enabled, configured: o.configured,
    environment: o.environment,
    specialist_route: "/admin/settings/payments",
  };
}

function normalizeResend(v: unknown): ResendIntegration | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const allowed = new Set([
    "id", "purpose", "configured", "sender_address", "domain", "specialist_route",
  ]);
  for (const k of Object.keys(o)) if (!allowed.has(k)) return null;
  if (o.id !== "resend") return null;
  if (o.purpose !== "transactional_email") return null;
  if (!isBool(o.configured)) return null;
  if (o.sender_address !== "info@jojoprompts.com") return null;
  if (o.domain !== "jojoprompts.com") return null;
  if (o.specialist_route !== "/admin/settings/email") return null;
  return {
    id: "resend", purpose: "transactional_email",
    configured: o.configured,
    sender_address: "info@jojoprompts.com",
    domain: "jojoprompts.com",
    specialist_route: "/admin/settings/email",
  };
}

function normalizeCloudmersive(v: unknown): CloudmersiveIntegration | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const allowed = new Set([
    "id", "purpose", "configured",
    "api_key_configured", "worker_secret_configured", "specialist_route",
  ]);
  for (const k of Object.keys(o)) if (!allowed.has(k)) return null;
  if (o.id !== "cloudmersive") return null;
  if (o.purpose !== "package_scanning") return null;
  if (!isBool(o.configured)) return null;
  if (!isBool(o.api_key_configured)) return null;
  if (!isBool(o.worker_secret_configured)) return null;
  if (o.specialist_route !== "/admin/trust/scans") return null;
  // Consistency: configured only when both sub-booleans are true.
  if (o.configured !== (o.api_key_configured && o.worker_secret_configured)) {
    return null;
  }
  return {
    id: "cloudmersive", purpose: "package_scanning",
    configured: o.configured,
    api_key_configured: o.api_key_configured,
    worker_secret_configured: o.worker_secret_configured,
    specialist_route: "/admin/trust/scans",
  };
}

function normalizeLovable(v: unknown): LovableAiIntegration | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const allowed = new Set([
    "id", "purpose", "configured", "application_services", "specialist_route",
  ]);
  for (const k of Object.keys(o)) if (!allowed.has(k)) return null;
  if (o.id !== "lovable_ai") return null;
  if (o.purpose !== "ai_studio") return null;
  if (!isBool(o.configured)) return null;
  if (o.specialist_route !== "/admin/publishing/new") return null;
  const svc = o.application_services;
  if (!Array.isArray(svc) || svc.length !== 2) return null;
  if (svc[0] !== "ai-studio-chat" || svc[1] !== "ai-studio-image") return null;
  return {
    id: "lovable_ai", purpose: "ai_studio",
    configured: o.configured,
    application_services: ["ai-studio-chat", "ai-studio-image"],
    specialist_route: "/admin/publishing/new",
  };
}

function normalizeMcp(v: unknown): McpIntegration | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const allowed = new Set([
    "id", "purpose", "configuration_state", "auth", "service",
    "contract_version", "tools", "endpoint", "deployment_status",
  ]);
  for (const k of Object.keys(o)) if (!allowed.has(k)) return null;
  if (o.id !== "jojoprompts_mcp") return null;
  if (o.purpose !== "mcp_access") return null;
  if (o.configuration_state !== "application_contract") return null;
  if (o.auth !== "supabase_oauth") return null;
  if (o.service !== "mcp") return null;
  if (o.contract_version !== "0.1.0") return null;
  if (o.deployment_status !== "not_checked") return null;
  const tools = o.tools;
  if (!Array.isArray(tools) || tools.length !== 1) return null;
  if (tools[0] !== "list_my_prompts") return null;
  if (o.endpoint !== MCP_ENDPOINT) return null;
  return {
    id: "jojoprompts_mcp", purpose: "mcp_access",
    configuration_state: "application_contract",
    auth: "supabase_oauth", service: "mcp",
    contract_version: "0.1.0",
    tools: ["list_my_prompts"],
    endpoint: MCP_ENDPOINT,
    deployment_status: "not_checked",
  };
}

export function normalizeIntegrationsSettingsStatus(
  input: unknown,
): IntegrationsSettingsStatus | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  for (const k of Object.keys(raw)) if (!TOP_ALLOWED.has(k)) return null;
  if (!noSecretKeysDeep(raw)) return null;
  if (!isIsoString(raw.as_of)) return null;

  const list = raw.integrations;
  if (!Array.isArray(list)) return null;
  if (list.length !== INTEGRATION_ORDER.length) return null;

  const seen = new Set<string>();
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i] as Record<string, unknown> | null;
    if (!item || typeof item !== "object") return null;
    const id = item.id;
    if (typeof id !== "string" || id !== INTEGRATION_ORDER[i]) return null;
    if (seen.has(id)) return null;
    seen.add(id);
  }

  const up = normalizeUpayments(list[0]);
  const rs = normalizeResend(list[1]);
  const cm = normalizeCloudmersive(list[2]);
  const la = normalizeLovable(list[3]);
  const mc = normalizeMcp(list[4]);
  if (!up || !rs || !cm || !la || !mc) return null;

  const b = raw.boundaries as Record<string, unknown> | undefined;
  if (!b || typeof b !== "object") return null;
  const bAllowed = new Set([
    "provider_health", "deployment_status", "secret_values",
  ]);
  for (const k of Object.keys(b)) if (!bAllowed.has(k)) return null;
  if (b.provider_health !== "not_checked") return null;
  if (b.deployment_status !== "not_checked") return null;
  if (b.secret_values !== "never_exposed") return null;

  return {
    as_of: raw.as_of,
    integrations: [up, rs, cm, la, mc],
    boundaries: {
      provider_health: "not_checked",
      deployment_status: "not_checked",
      secret_values: "never_exposed",
    },
  };
}

// ------------------------------ Presentation ------------------------------

export function integrationDisplayName(id: IntegrationId): string {
  switch (id) {
    case "upayments": return "UPayments";
    case "resend": return "Resend";
    case "cloudmersive": return "Cloudmersive";
    case "lovable_ai": return "Lovable AI Gateway";
    case "jojoprompts_mcp": return "JojoPrompts MCP";
  }
}

export function purposeLabel(p: Integration["purpose"]): string {
  switch (p) {
    case "payments": return "Payments";
    case "transactional_email": return "Transactional email";
    case "package_scanning": return "Package scanning";
    case "ai_studio": return "AI Studio";
    case "mcp_access": return "MCP access";
  }
}

export type IntegrationStatusLabel =
  | "Configured"
  | "Needs configuration"
  | "Application contract";

export function integrationStatus(i: Integration): {
  label: IntegrationStatusLabel;
  tone: StatusTone;
} {
  if (i.id === "jojoprompts_mcp") {
    return { label: "Application contract", tone: "info" };
  }
  return i.configured
    ? { label: "Configured", tone: "ok" }
    : { label: "Needs configuration", tone: "warn" };
}

export type IntegrationsSummary = {
  total: number;
  configured: number;
  needs_configuration: number;
  contract_only: number;
};

export function summarize(status: IntegrationsSettingsStatus): IntegrationsSummary {
  let configured = 0, needs = 0, contract = 0;
  for (const i of status.integrations) {
    const s = integrationStatus(i);
    if (s.label === "Configured") configured += 1;
    else if (s.label === "Needs configuration") needs += 1;
    else contract += 1;
  }
  return {
    total: status.integrations.length,
    configured,
    needs_configuration: needs,
    contract_only: contract,
  };
}

export const INTEGRATIONS_SECRETS_URL =
  "https://supabase.com/dashboard/project/fxkqgjakbyrxkmevkglv/functions/secrets";
