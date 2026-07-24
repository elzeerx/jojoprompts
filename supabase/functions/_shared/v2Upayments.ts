// V2 UPayments shared helpers (hosted non-whitelabel checkout).
//
// Official endpoints (UPayments API v1):
//   POST   {BASE}/charge
//   GET    {BASE}/get-payment-status/{track_id}       (by track id)
//   GET    {BASE}/get-payment-status?session_id=...   (by session id)
//   POST   {BASE}/create-refund
//   GET    {BASE}/check-refund/{provider_reference}   (provider check id)
//
// Bases:
//   sandbox    = https://sandboxapi.upayments.com/api/v1
//   production = https://uapi.upayments.com/api/v1
//
// Provider calls are disabled unless V2_UPAYMENTS_ENABLED === "true".
// Never log tokens, request/response bodies, PII, or raw webhook payloads.

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

// Public browser redirect origins we will build /checkout URLs for.
const ALLOWED_SITE_URLS = new Set<string>([
  "https://jojoprompts.com",
  "https://www.jojoprompts.com",
  "https://jojoprompts.lovable.app",
]);
const DEFAULT_SITE_URL = "https://jojoprompts.com";

// Only https://*.upayments.com hosts are acceptable for a provider redirect.
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

export function methodGuard(req: Request, method: "POST"): Response | null {
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

// Reject objects whose top-level keys are outside a documented allowlist.
export function hasOnlyAllowedKeys(
  obj: Record<string, unknown>, allowed: readonly string[],
): boolean {
  const set = new Set(allowed);
  for (const k of Object.keys(obj)) if (!set.has(k)) return false;
  return true;
}

// ---------------------------------------------------------- Env / config

export type UpaymentsConfig = {
  enabled: boolean;
  environment: "sandbox" | "production";
  baseUrl: string;
  token: string;
  siteUrl: string;
};

const SANDBOX_BASE = "https://sandboxapi.upayments.com/api/v1";
const PROD_BASE = "https://uapi.upayments.com/api/v1";

// Returns the effective site URL or null if V2_PUBLIC_SITE_URL is explicitly
// set to a non-allowlisted value. Unset falls back to the production default.
export function loadPublicSiteUrl(): string | null {
  const raw = (Deno.env.get("V2_PUBLIC_SITE_URL") ?? "").trim();
  if (!raw) return DEFAULT_SITE_URL;
  if (ALLOWED_SITE_URLS.has(raw)) return raw;
  return null;
}

export function loadUpaymentsConfig(): UpaymentsConfig | null {
  const enabled = Deno.env.get("V2_UPAYMENTS_ENABLED") === "true";
  if (!enabled) return null;
  const env = Deno.env.get("V2_UPAYMENTS_ENVIRONMENT");
  const token = Deno.env.get("V2_UPAYMENTS_API_TOKEN") ?? "";
  if (!token) return null;
  const siteUrl = loadPublicSiteUrl();
  if (!siteUrl) return null;
  let baseUrl = "";
  let environment: "sandbox" | "production";
  if (env === "sandbox") { baseUrl = SANDBOX_BASE; environment = "sandbox"; }
  else if (env === "production") { baseUrl = PROD_BASE; environment = "production"; }
  else return null;
  return { enabled: true, environment, baseUrl, token, siteUrl };
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

// -------------------------------- Customer identity (server-side only)

export type CustomerFields = {
  uniqueId: string;
  name?: string;
  email?: string;
  mobile?: string;
};

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-zA-Z]{2,}$/;
// UPayments Make Charge docs: customer.mobile max length 15 (E.164 incl. '+').
const MOBILE_RE = /^\+[1-9][0-9]{6,13}$/;

// UPayments Make Charge documented field limits.
const UPAY_CUSTOMER_NAME_MAX = 50;
const UPAY_CUSTOMER_EMAIL_MAX = 50;
const UPAY_CUSTOMER_MOBILE_MAX = 15;

// Loads verified server-side identity; never returns caller-supplied fields
// or dummy placeholders. Optional fields are dropped when invalid/missing.
export async function loadCustomerFields(
  svc: SupabaseClient, userId: string,
): Promise<CustomerFields> {
  const out: CustomerFields = { uniqueId: userId };
  const { data: prof } = await svc
    .from("profiles")
    .select("first_name,last_name,email,phone_number")
    .eq("id", userId)
    .maybeSingle();

  let email = typeof prof?.email === "string" ? prof.email.trim() : "";
  if (!email) {
    try {
      const { data } = await svc.auth.admin.getUserById(userId);
      email = (data?.user?.email ?? "").trim();
    } catch { /* ignore */ }
  }
  // Never truncate an email; drop it if it would violate the documented limit
  // or fails RFC-ish validation.
  if (email && EMAIL_RE.test(email) && email.length <= UPAY_CUSTOMER_EMAIL_MAX) {
    out.email = email;
  }

  const first = typeof prof?.first_name === "string" ? prof.first_name.trim() : "";
  const last = typeof prof?.last_name === "string" ? prof.last_name.trim() : "";
  const nameRaw = `${first} ${last}`.trim();
  if (nameRaw.length >= 1) {
    // Safe to cap: a truncated display name remains valid data.
    const name = nameRaw.slice(0, UPAY_CUSTOMER_NAME_MAX).trim();
    if (name.length >= 1) out.name = name;
  }

  const phone = typeof prof?.phone_number === "string" ? prof.phone_number.trim() : "";
  if (phone && phone.length <= UPAY_CUSTOMER_MOBILE_MAX && MOBILE_RE.test(phone)) {
    out.mobile = phone;
  }

  return out;
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
  cfg: UpaymentsConfig, path: string,
  init: { method: "GET" | "POST"; body?: unknown },
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
      return { kind: "http_error", status: res.status, safeText: `status_${res.status}` };
    }
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : {}; }
    catch { return { kind: "invalid_response", status: res.status }; }
    if (json === null || typeof json !== "object" || Array.isArray(json)) {
      return { kind: "invalid_response", status: res.status };
    }
    return { kind: "ok", status: res.status, json: json as Record<string, unknown> };
  } catch (e) {
    if ((e as Error).name === "AbortError") return { kind: "timeout" };
    return { kind: "network_error" };
  } finally { clearTimeout(timer); }
}

// Official provider top-level success flag. Provider returns `status: true|false`.
export function providerSuccessFlag(json: Record<string, unknown>): boolean {
  return json["status"] === true;
}

// ---------------------------------------------- Response field extraction

function pickPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur && typeof cur === "object" && !Array.isArray(cur)
        && k in (cur as Record<string, unknown>)) {
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
      ["data","track_id"],["data","trackId"],["track_id"],["trackId"],
    ]),
    sessionId: firstString(json, [
      ["data","session_id"],["data","sessionId"],["session_id"],["sessionId"],
    ]),
    providerOrderId: firstString(json, [
      ["data","order_id"],["data","orderId"],["data","reference"],
      ["order_id"],["orderId"],["reference"],
    ]),
    paymentUrl: firstString(json, [
      ["data","payment_url"],["data","paymentUrl"],
      ["data","link"],["payment_url"],["paymentUrl"],["link"],
    ]),
  };
}

// Explicit allowlists. NO substring/contains matching. Unknown => pending.
// Aligned exactly to the SQL functions v2_apply_verified_refund /
// v2_settle_verified_upayments_payment result allowlists.
const PAY_CAPTURED = new Set(["CAPTURED","SUCCESS","PAID"]);
const PAY_FAILED = new Set(["FAILED","DECLINED","ERROR","REJECTED"]);
const PAY_CANCELLED = new Set(["CANCELLED","CANCELED","USER_CANCELLED","VOIDED"]);
const PAY_PENDING = new Set(["PENDING","INITIATED","PROCESSING","AUTHORIZED","IN_PROGRESS"]);

export type PaymentVerdict = "captured" | "failed" | "cancelled" | "pending" | "unknown";
export function normalizePaymentStatus(
  raw: string | null,
): { verdict: PaymentVerdict; normalized: string } {
  if (!raw) return { verdict: "unknown", normalized: "" };
  const n = raw.trim().toUpperCase().slice(0, 64);
  if (PAY_CAPTURED.has(n)) return { verdict: "captured", normalized: n };
  if (PAY_FAILED.has(n)) return { verdict: "failed", normalized: n };
  if (PAY_CANCELLED.has(n)) return { verdict: "cancelled", normalized: n };
  if (PAY_PENDING.has(n)) return { verdict: "pending", normalized: n };
  return { verdict: "unknown", normalized: n };
}

const REF_PROCESSED = new Set(["REFUNDED","PROCESSED","SUCCESS"]);
const REF_FAILED = new Set(["FAILED","DECLINED","ERROR","REJECTED","CANCELLED","CANCELED"]);
const REF_PENDING = new Set(["PENDING","INITIATED","PROCESSING","APPROVED"]);

export type RefundVerdict = "processed" | "failed" | "pending" | "unknown";
export function normalizeRefundStatus(
  raw: string | null,
): { verdict: RefundVerdict; normalized: string } {
  if (!raw) return { verdict: "unknown", normalized: "" };
  const n = raw.trim().toUpperCase().slice(0, 64);
  if (REF_PROCESSED.has(n)) return { verdict: "processed", normalized: n };
  if (REF_FAILED.has(n)) return { verdict: "failed", normalized: n };
  if (REF_PENDING.has(n)) return { verdict: "pending", normalized: n };
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
    trackId: firstString(json, [
      ["data","track_id"],["data","trackId"],["track_id"],["trackId"],
    ]),
    sessionId: firstString(json, [
      ["data","session_id"],["data","sessionId"],["session_id"],["sessionId"],
    ]),
    providerOrderId: firstString(json, [
      ["data","order_id"],["data","orderId"],["order_id"],["orderId"],
    ]),
    merchantReference: firstString(json, [
      // Official aliases include requested_order_id / requestedOrderId.
      ["data","requested_order_id"],["data","requestedOrderId"],
      ["requested_order_id"],["requestedOrderId"],
      ["data","reference"],["data","merchant_reference"],["data","merchantReference"],
      ["reference"],["merchant_reference"],["merchantReference"],
    ]),
    amountRaw: firstString(json, [
      ["data","amount"],["data","total_paid"],["data","totalPaid"],
      ["amount"],["total_paid"],["totalPaid"],
    ]),
    currency: firstString(json, [["data","currency"],["currency"]]),
    result: firstString(json, [
      ["data","result"],["data","payment_status"],["data","paymentStatus"],
      ["data","status"],["result"],["payment_status"],["paymentStatus"],["status"],
    ]),
  };
}

export type RefundResponseExtract = {
  providerReference: string | null;      // data.orderId (check id)
  providerRefundOrderId: string | null;  // data.refundOrderId
  refundArn: string | null;
  amountRaw: string | null;
  currency: string | null;
  result: string | null;
};

// For POST /create-refund and GET /check-refund/{provider_reference}.
export function extractRefundResponseFields(
  json: Record<string, unknown>,
): RefundResponseExtract {
  return {
    // "orderId" here is UPayments' provider refund CHECK order id.
    providerReference: firstString(json, [
      ["data","orderId"],["data","order_id"],["orderId"],["order_id"],
    ]),
    providerRefundOrderId: firstString(json, [
      ["data","refundOrderId"],["data","refund_order_id"],
      ["refundOrderId"],["refund_order_id"],
    ]),
    refundArn: firstString(json, [
      ["data","refundArn"],["data","refund_arn"],["refundArn"],["refund_arn"],
    ]),
    amountRaw: firstString(json, [
      ["data","amount"],["data","totalPrice"],["amount"],["totalPrice"],
    ]),
    currency: firstString(json, [["data","currency"],["currency"]]),
    result: firstString(json, [
      ["data","status"],["data","result"],["status"],["result"],
    ]),
  };
}

// ---------------------------------------------------------- Sanitizers

// Allowlist of scalar keys we are willing to persist in event payloads.
// Nothing else — never provider tokens, PII, customer names/emails.
const SAFE_KEYS = new Set([
  "kind","status","result","reference","merchant_reference","order_id",
  "orderId","track_id","trackId","session_id","sessionId","refund_order_id",
  "refundOrderId","requested_order_id","requestedOrderId",
  "refund_arn","refundArn","amount","currency","http_status",
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
  const nested = source["data"] && typeof source["data"] === "object" && !Array.isArray(source["data"])
    ? source["data"] as Record<string, unknown> : {};
  const flat = { ...source, ...nested };
  for (const k of Object.keys(flat)) {
    if (!SAFE_KEYS.has(k)) continue;
    out[k] = coerceScalar(flat[k]);
  }
  const s = JSON.stringify(out);
  if (s.length > 60_000) return { kind, http_status: out.http_status ?? null, truncated: true };
  return out;
}

// -------------------------------------------------- Safe error surfacing

// Never surface raw Postgres/RPC messages. Map a small allowlist of
// caller-safe codes; everything else becomes "server_error".
const SAFE_ERROR_CODES = new Set([
  "actor_not_owner","actor_not_authorized","order_not_pending","order_not_found",
  "attempt_not_found","provider_mismatch","recovery_required","backoff_active",
  "global_backoff","refund_not_pending","refund_not_pollable","refund_not_found",
  "refund_not_approved","refund_identifier_mismatch",
  "refund_identifier_replay_mismatch",
  "missing_refund_identifiers","missing_provider_reference",
  "missing_provider_refund_order_id","insufficient_permissions",
  "external_event_conflict","currency_mismatch","amount_mismatch",
  "identifier_mismatch","invalid_body","invalid_json","invalid_amount",
  "invalid_merchant_reference","invalid_provider_reference",
  "invalid_provider_refund_order_id","order_zero_total","submission_state_invalid",
  "not_found","no_attempt","not_authorized",
]);

export function safeRpcError(err: unknown): string {
  const msg = (err && typeof err === "object" && "message" in err)
    ? String((err as { message: unknown }).message) : "";
  const head = msg.split(":", 1)[0]?.trim();
  if (head && SAFE_ERROR_CODES.has(head)) return head;
  return "server_error";
}

// -------------------------------------------------- Deterministic event ids

export function eventIdForCharge(attemptId: string, providerId: string | null): string {
  const suffix = (providerId ?? "unknown").slice(0, 64);
  return `upay:charge:${attemptId}:${suffix}`.slice(0, 256);
}
export function eventIdForStatus(
  orderId: string, providerId: string | null, verdict: string,
): string {
  const suffix = (providerId ?? "no_pid").slice(0, 64);
  return `upay:status:${orderId}:${verdict}:${suffix}`.slice(0, 256);
}

// Refund event id — MUST include a bounded phase so authorized/create,
// terminal-processed, and terminal-failed all have distinct external_event_id
// values while remaining retry-stable within the same phase.
export type RefundEventPhase =
  | "create_authorized"
  | "status_processed"
  | "status_failed";
export function eventIdForRefund(
  refundId: string, phase: RefundEventPhase,
  providerRefundOrderId: string | null,
): string {
  const suffix = (providerRefundOrderId ?? "unknown").slice(0, 64);
  return `upay:refund:${refundId}:${phase}:${suffix}`.slice(0, 256);
}

// Local, stable refund reference sent to provider (bounded, no PII).
export function localRefundReference(refundId: string): string {
  return `REF-${refundId}`.slice(0, 40);
}

// ---------------------- Strict webhook envelope validator --------------

// Documented UPayments webhook payload fields (snake_case). These are
// accepted as hints only — do not trust for settlement, do not persist
// unless already in SAFE_KEYS. Provider GET re-verification remains the
// only source of payment truth.
const WEBHOOK_DOC_FIELDS = [
  "payment_id","result","post_date","tran_id","ref","track_id","auth",
  "order_id","requested_order_id","refund_order_id","payment_type",
  "invoice_id","transaction_date","receipt_id","trn_udf",
] as const;

const WEBHOOK_TOP_KEYS: ReadonlySet<string> = new Set([
  "status","message","statusMessage","errorMessage","data","result",
  "track_id","trackId","session_id","sessionId",
  "order_id","orderId","reference","requested_order_id","requestedOrderId",
  "merchant_reference","merchantReference",
  "payment_status","paymentStatus","amount","currency","total_paid","totalPaid",
  ...WEBHOOK_DOC_FIELDS,
]);
const WEBHOOK_DATA_KEYS: ReadonlySet<string> = new Set([
  "track_id","trackId","session_id","sessionId",
  "order_id","orderId","reference","requested_order_id","requestedOrderId",
  "merchant_reference","merchantReference",
  "payment_status","paymentStatus","status","result",
  "amount","currency","total_paid","totalPaid",
  ...WEBHOOK_DOC_FIELDS,
]);
// non-plain data, and payloads with zero identifier hints.
export function validateWebhookEnvelope(
  body: unknown,
): { ok: true } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_body" };
  }
  const obj = body as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (!WEBHOOK_TOP_KEYS.has(k)) return { ok: false, error: "invalid_body" };
  }
  if ("data" in obj) {
    const d = obj["data"];
    if (d != null) {
      if (typeof d !== "object" || Array.isArray(d)) {
        return { ok: false, error: "invalid_body" };
      }
      for (const k of Object.keys(d as Record<string, unknown>)) {
        if (!WEBHOOK_DATA_KEYS.has(k)) return { ok: false, error: "invalid_body" };
      }
    }
  }
  const ex = extractStatusFields(obj);
  if (!ex.trackId && !ex.sessionId && !ex.providerOrderId && !ex.merchantReference) {
    return { ok: false, error: "unresolvable" };
  }
  return { ok: true };
}
