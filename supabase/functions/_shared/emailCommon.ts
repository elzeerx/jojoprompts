// Shared primitives for send-email and submit-contact edge functions.
// Deliberately minimal — no imports outside Deno std to keep them portable
// and easy to unit-test with Deno.test.

// ------------------------------ CORS

// Allowlist covers only origins we know actually call these functions today:
// Jojo production, Lovable production, Lovable private preview subdomain,
// and localhost for dev. Wildcards would re-open the primitive we're closing.
export const ALLOWED_EMAIL_ORIGINS = new Set<string>([
  "https://jojoprompts.com",
  "https://www.jojoprompts.com",
  "https://jojoprompts.lovable.app",
  "https://id-preview--766f3370-d38c-42e5-8566-5e4946986dd2.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
]);

export function corsHeadersFor(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_EMAIL_ORIGINS.has(origin) ? origin : "";
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
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(origin), "Content-Type": "application/json" },
  });
}

export function methodGuardPost(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "method_not_allowed" }, 405, origin);
  }
  return null;
}

// --------------------------- Bounded JSON

const MAX_REQ_BYTES = 64 * 1024;

export async function readBoundedJson<T = unknown>(
  req: Request,
): Promise<
  { ok: true; body: T } | { ok: false; status: number; error: string }
> {
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

export function hasOnlyAllowedKeys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const set = new Set(allowed);
  for (const k of Object.keys(obj)) if (!set.has(k)) return false;
  return true;
}

// --------------------------- HMAC / hashing / constant time

export async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

// Constant-time equality on strings that are the same length.
// Returns false for different-length inputs without early-exit timing leak
// on the length check itself (short-circuit here is acceptable because
// bearer tokens have a fixed length).
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// --------------------------- Email normalization / validation

// Very conservative: lowercased, trimmed. Does NOT strip subaddresses.
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return null;
  // Simple RFC-ish check: exactly one @, non-empty local + domain, domain has a dot.
  const at = trimmed.indexOf("@");
  if (at <= 0 || at !== trimmed.lastIndexOf("@")) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (local.length === 0 || local.length > 64) return null;
  if (domain.length === 0 || domain.length > 253) return null;
  if (!domain.includes(".")) return null;
  if (/\s/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

// --------------------------- HTML/text safety

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function nl2brSafe(input: string): string {
  return escapeHtml(input).replace(/\n/g, "<br>");
}

// --------------------------- IP extraction (best-effort, non-authoritative)

export function ipFromReq(req: Request): string {
  // Supabase forwards the client IP in x-forwarded-for. Take the first token.
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const first = fwd.split(",")[0]?.trim() ?? "";
  if (first) return first;
  return req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    "unknown";
}
