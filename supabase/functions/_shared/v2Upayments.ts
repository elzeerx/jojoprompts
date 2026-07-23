// V2 UPayments shared helpers (hosted non-whitelabel checkout).
//
// Official endpoints (see UPayments API v1 docs):
//   POST   {BASE}/charge
//   GET    {BASE}/get-payment-status/{track_id}    (or ?session_id=)
//   POST   {BASE}/create-refund
//   GET    {BASE}/check-refund/{provider_order_id}
//
// Bases:
//   sandbox    = https://sandboxapi.upayments.com/api/v1
//   production = https://uapi.upayments.com/api/v1
//
// Provider calls are disabled unless V2_UPAYMENTS_ENABLED === "true".
// Never log tokens, request/response bodies, PII, emails, names, URLs
// carrying tokens, or raw webhook payloads.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// -------------------------------------------------------------- CORS

const ALLOWED_ORIGINS = new Set<string>([
  "https://jojoprompts.com",
  "https://www.jojoprompts.com",
  "https://jojoprompts.lovable.app",
  "https://id-preview--766f3370-d38c-42e5-8566-5e4946986dd2.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
]);

// Redirect/notification URLs the provider is allowed to point back to.
const ALLOWED_REDIRECT_HOSTS = new Set<string>([
  "jojoprompts.com",
  "www.jojoprompts.com",
  "jojoprompts.lovable.app",
  "id-preview--766f3370-d38c-42e5-8566-5e4946986dd2.lovable.app",
]);

// Only https://*.upayments.com hosts are acceptable for a payment redirect.
export function isValidUpaymentsRedirectUrl(raw: string): boolean {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return false;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const host = u.hostname.toLowerCase();
  return host === "upayments.com" || host.endsWith(".upayments.com");
}

export function corsHeadersFor(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
  };
}

export function jsonResponse(
  body: unknown, status: number, origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
  });
}

export function methodGuard(
  req: Request, method: "POST",
): Response | null {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(origin) });
  }
  if (req.method !== method) {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  }
  return null;
}

const MAX_REQ_BYTES = 64 * 1024;

export async function readBoundedJson<T = unknown>(
  req: Request,
): Promise<{ ok: true; body: T } | { ok: false; status: number; error: string }> {
  const cl = req.headers.get("content-length");
  if (cl && Number(cl) > MAX_REQ_BYTES) {
    return { ok: false, status: 413, error: "request_too_large" };
  }
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_REQ_BYTES) {
    return { ok: false, status: 413, error: "request_too_large" };
  }
  try {
    const text = new TextDecoder().decode(buf);
    const obj = text ? JSON.parse(text) : {};
    return { ok: true, body: obj as T };
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
}

// ---------------------------------------------------------- Env / config

export type UpaymentsConfig = {
  enabled: boolean;
  environment: "sandbox" | "production";
  baseUrl: string;
  token: string;
};

const SANDBOX_BASE = "https://sandboxapi.upayments.com/api/v1";
const PROD_BASE = "https://uapi.upayments.com/api/v1";

export function loadUpaymentsConfig(): UpaymentsConfig | null {
  const enabled = Deno.env.get("V2_UPAYMENTS_ENABLED") === "true";
  if (!enabled) return null;
  const env = Deno.env.get("V2_UPAYMENTS_ENVIRONMENT");
  const token = Deno.env.get("V2_UPAYMENTS_API_TOKEN") ?? "";
  if (!token) return null;
  let baseUrl = "";
  let environment: "sandbox" | "production";
  if (env === "sandbox") { baseUrl = SANDBOX_BASE; environment = "sandbox"; }
  else if (env === "production") { baseUrl = PROD_BASE; environment = "production"; }
  else return null;
  return { enabled: true, environment, baseUrl, token };
}

// --------------------------------------------------------- Supabase / auth

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function requireUser(
  req: Request,
): Promise<{ userId: string; token: string } | { error: Response }> {
  const origin = req.headers.get("origin");
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { error: jsonResponse({ error: "unauthorized" }, 401, origin) };
  }
  const token = auth.slice(7);
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data, error } = await anon.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return { error: jsonResponse({ error: "unauthorized" }, 401, origin) };
  }
  return { userId: data.claims.sub as string, token };
}

export async function requireAdmin(
  req: Request,
): Promise<{ userId: string } | { error: Response }> {
  const u = await requireUser(req);
  if ("error" in u) return u;
  const svc = serviceClient();
  const { data, error } = await svc.rpc("has_role", {
    _user_id: u.userId, _role: "admin",
  });
  const origin = req.headers.get("origin");
  if (error || !data) {
    return { error: jsonResponse({ error: "forbidden" }, 403, origin) };
  }
  return { userId: u.userId };
}

// ------------------------------------------------------- KWD conversions

// KWD authoritative unit is fils (1 KWD = 1000 fils). Provider expects a
// decimal string with exactly three fractional digits.
export function filsToKwdDecimal(fils: number): string {
  if (!Number.isInteger(fils) || fils < 0 || fils > 1_000_000_000) {
    throw new Error("invalid_fils_amount");
  }
  const whole = Math.floor(fils / 1000);
  const frac = fils % 1000;
  return `${whole}.${frac.toString().padStart(3, "0")}`;
}

export function kwdDecimalToFils(raw: string): number {
  if (typeof raw !== "string") throw new Error("invalid_amount_type");
  const s = raw.trim();
  if (!/^\d{1,9}(?:\.\d{1,3})?$/.test(s)) throw new Error("invalid_amount_format");
  const [w, f = ""] = s.split(".");
  const whole = Number(w);
  const fracPadded = (f + "000").slice(0, 3);
  const frac = Number(fracPadded);
  const result = whole * 1000 + frac;
  if (!Number.isFinite(result) || result < 0) throw new Error("invalid_amount_range");
  return result;
}

// ---------------------------------------------------- Provider HTTP fetch

const MAX_RESPONSE_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 12_000;

export type ProviderCallResult =
  | { kind: "ok"; status: number; json: Record<string, unknown> }
  | { kind: "http_error"; status: number; safeText: string }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_response"; status?: number };

export async function providerFetch(
  cfg: UpaymentsConfig, path: string, init: { method: "GET" | "POST"; body?: unknown },
): Promise<ProviderCallResult> {
  const url = `${cfg.baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: init.method,
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.token}`,
      },
      body: init.body != null ? JSON.stringify(init.body) : undefined,
    });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_RESPONSE_BYTES) {
      return { kind: "invalid_response", status: res.status };
    }
    const text = new TextDecoder().decode(buf);
    if (!res.ok) {
      // Do not surface provider body to caller. Bounded safe hint only.
      return { kind: "http_error", status: res.status, safeText: `status_${res.status}` };
    }
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : {}; } catch { return { kind: "invalid_response", status: res.status }; }
    if (json === null || typeof json !== "object" || Array.isArray(json)) {
      return { kind: "invalid_response", status: res.status };
    }
    return { kind: "ok", status: res.status, json: json as Record<string, unknown> };
  } catch (e) {
    if ((e as Error).name === "AbortError") return { kind: "timeout" };
    return { kind: "network_error" };
  } finally { clearTimeout(timer); }
}

// ---------------------------------------------- Response field extraction

// Provider responses vary between snake_case / camelCase / nested `data`.
// Extract cautiously; a successful HTTP status is NEVER settlement.

function pickPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur && typeof cur === "object" && !Array.isArray(cur) && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k];
    } else return undefined;
  }
  return cur;
}

function firstString(obj: unknown, paths: string[][]): string | null {
  for (const p of paths) {
    const v = pickPath(obj, p);
    if (typeof v === "string" && v.length > 0 && v.length <= 256) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v).slice(0, 64);
  }
  return null;
}

export type ChargeExtract = {
  trackId: string | null;
  sessionId: string | null;
  providerOrderId: string | null;
  paymentUrl: string | null;
};

export function extractChargeFields(json: Record<string, unknown>): ChargeExtract {
  return {
    trackId: firstString(json, [
      ["data", "track_id"], ["data", "trackId"], ["track_id"], ["trackId"],
    ]),
    sessionId: firstString(json, [
      ["data", "session_id"], ["data", "sessionId"], ["session_id"], ["sessionId"],
    ]),
    providerOrderId: firstString(json, [
      ["data", "order_id"], ["data", "orderId"], ["data", "reference"],
      ["order_id"], ["orderId"], ["reference"],
    ]),
    paymentUrl: firstString(json, [
      ["data", "payment_url"], ["data", "paymentUrl"],
      ["data", "link"], ["payment_url"], ["paymentUrl"], ["link"],
    ]),
  };
}

const RESULT_CAPTURED = new Set(["CAPTURED", "SUCCESS", "PAID", "SUCCESSFUL", "COMPLETED"]);
const RESULT_FAILED = new Set(["FAILED", "DECLINED", "ERROR", "REJECTED"]);
const RESULT_CANCELLED = new Set(["CANCELLED", "CANCELED", "USER_CANCELLED"]);
const RESULT_PENDING = new Set(["PENDING", "INITIATED", "PROCESSING", "AUTHORIZED"]);

export type StatusVerdict = "captured" | "failed" | "cancelled" | "pending" | "unknown";

export function normalizeStatusResult(raw: string | null): { verdict: StatusVerdict; normalized: string } {
  if (!raw) return { verdict: "unknown", normalized: "" };
  const n = raw.trim().toUpperCase().slice(0, 64);
  if (RESULT_CAPTURED.has(n)) return { verdict: "captured", normalized: n };
  if (RESULT_FAILED.has(n)) return { verdict: "failed", normalized: n };
  if (RESULT_CANCELLED.has(n)) return { verdict: "cancelled", normalized: n };
  if (RESULT_PENDING.has(n)) return { verdict: "pending", normalized: n };
  return { verdict: "unknown", normalized: n };
}

export type StatusExtract = {
  trackId: string | null;
  sessionId: string | null;
  providerOrderId: string | null;
  merchantReference: string | null;
  amountRaw: string | null;
  currency: string | null;
  result: string | null;
};

export function extractStatusFields(json: Record<string, unknown>): StatusExtract {
  return {
    trackId: firstString(json, [["data","track_id"],["data","trackId"],["track_id"],["trackId"]]),
    sessionId: firstString(json, [["data","session_id"],["data","sessionId"],["session_id"],["sessionId"]]),
    providerOrderId: firstString(json, [["data","order_id"],["data","orderId"],["order_id"],["orderId"]]),
    merchantReference: firstString(json, [
      ["data","reference"], ["data","merchant_reference"], ["data","merchantReference"],
      ["reference"], ["merchant_reference"], ["merchantReference"],
    ]),
    amountRaw: firstString(json, [
      ["data","amount"], ["data","total_paid"], ["data","totalPaid"],
      ["amount"], ["total_paid"], ["totalPaid"],
    ]),
    currency: firstString(json, [["data","currency"],["currency"]]),
    result: firstString(json, [
      ["data","result"], ["data","payment_status"], ["data","paymentStatus"],
      ["data","status"], ["result"], ["payment_status"], ["paymentStatus"], ["status"],
    ]),
  };
}

export type RefundStatusExtract = {
  providerRefundOrderId: string | null;
  originalProviderOrderId: string | null;
  amountRaw: string | null;
  currency: string | null;
  result: string | null;
};

export function extractRefundStatusFields(json: Record<string, unknown>): RefundStatusExtract {
  return {
    providerRefundOrderId: firstString(json, [
      ["data","refund_order_id"], ["data","refundOrderId"], ["data","order_id"],
      ["refund_order_id"], ["refundOrderId"], ["order_id"],
    ]),
    originalProviderOrderId: firstString(json, [
      ["data","original_order_id"], ["data","originalOrderId"], ["data","reference"],
      ["original_order_id"], ["originalOrderId"], ["reference"],
    ]),
    amountRaw: firstString(json, [["data","amount"],["amount"]]),
    currency: firstString(json, [["data","currency"],["currency"]]),
    result: firstString(json, [
      ["data","status"], ["data","result"], ["status"], ["result"],
    ]),
  };
}

// ---------------------------------------------------------- Sanitizers

// Allowlist top-level keys and depth. Cap final payload at 64 KiB.
const SAFE_KEYS = new Set([
  "kind","status","result","reference","merchant_reference","order_id",
  "orderId","track_id","trackId","session_id","sessionId","refund_order_id",
  "refundOrderId","original_order_id","originalOrderId","amount","currency",
  "payment_url","paymentUrl","link","http_status",
]);

function coerceScalar(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === "boolean" || typeof v === "number") return v;
  if (typeof v === "string") return v.slice(0, 512);
  return null;
}

export function sanitizeProviderPayload(
  kind: string, source: Record<string, unknown>, httpStatus?: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = { kind };
  if (typeof httpStatus === "number") out.http_status = httpStatus;
  const flat = { ...source, ...(source["data"] && typeof source["data"] === "object" ? source["data"] as Record<string, unknown> : {}) };
  for (const k of Object.keys(flat)) {
    if (!SAFE_KEYS.has(k)) continue;
    out[k] = coerceScalar(flat[k]);
  }
  const s = JSON.stringify(out);
  if (s.length > 60_000) return { kind, http_status: out.http_status ?? null, truncated: true };
  return out;
}

// -------------------------------------------------- Deterministic event ids

// Stable, bounded ids that never contain PII or secrets.
export function eventIdForCharge(attemptId: string, providerId: string | null): string {
  const suffix = (providerId ?? "unknown").slice(0, 64);
  return `upay:charge:${attemptId}:${suffix}`.slice(0, 256);
}
export function eventIdForStatus(orderId: string, providerId: string | null, verdict: string): string {
  const suffix = (providerId ?? "no_pid").slice(0, 64);
  return `upay:status:${orderId}:${verdict}:${suffix}`.slice(0, 256);
}
export function eventIdForRefund(refundId: string, providerRefundOrderId: string | null): string {
  const suffix = (providerRefundOrderId ?? "unknown").slice(0, 64);
  return `upay:refund:${refundId}:${suffix}`.slice(0, 256);
}
