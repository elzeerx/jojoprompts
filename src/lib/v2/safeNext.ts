/**
 * V2 safe-next resolver.
 *
 * Pure, framework-free. Accepts an untrusted `next` value (typically from a
 * URL query string) and returns either a safe same-origin path (starting with
 * a single "/") or a fallback (default "/explore").
 *
 * Rejects:
 *   - values that are not already trimmed (raw !== raw.trim())
 *   - external URLs (http:, https:, ftp:, javascript:, data:, …)
 *   - protocol-relative URLs ("//evil.com") — including encoded forms
 *   - malformed / empty values
 *   - values that would cause a login/reset auth loop (/login, /signup,
 *     /reset-password, /email-confirmation, /auth/*, /magic-link-sent)
 *   - values whose nested `next=` query/fragment param (after
 *     URLSearchParams decoding) would itself be unsafe. Nested inspection is
 *     bounded (MAX_DEPTH) with cycle protection.
 *
 * Accepts internal V2 destinations preserving query strings, e.g.
 *   /checkout, /cart, /library, /orders, /account, /resources/foo?x=1,
 *   and nested internal next values (e.g. /account?next=/library).
 */

export const DEFAULT_SAFE_NEXT = "/explore";

const AUTH_LOOP_PREFIXES = [
  "/login",
  "/signup",
  "/reset-password",
  "/email-confirmation",
  "/magic-link-sent",
  "/auth/",
  "/auth?",
  "/auth#",
] as const;

const AUTH_LOOP_EXACT = new Set([
  "/login",
  "/signup",
  "/reset-password",
  "/email-confirmation",
  "/magic-link-sent",
  "/auth",
]);

const DANGEROUS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
// Any control character (C0 + DEL) OR whitespace inside the value is a
// smuggling vector (CRLF injection, header/URL splitting) — reject outright.
const WHITESPACE_RE = /\s/u;
// Backslashes anywhere in the value are a Windows-path / URL-normalization
// smuggling vector (some parsers treat "\" as "/"). Reject.
const BACKSLASH_RE = /\\/;

const MAX_NESTED_DEPTH = 4;

function containsControlOrWhitespace(value: string): boolean {
  if (WHITESPACE_RE.test(value)) return true;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

/**
 * Shallow validity check applied to a single candidate string. Does NOT
 * recurse into nested `next=` params.
 */
function isShallowSafe(value: string): boolean {
  // Must equal its own trim — no leading/trailing whitespace normalization.
  if (value !== value.trim()) return false;
  if (value.length === 0) return false;
  if (containsControlOrWhitespace(value)) return false;
  if (BACKSLASH_RE.test(value)) return false;
  // Reject protocol-relative ("//x") and any scheme-bearing input.
  if (value.startsWith("//")) return false;
  if (DANGEROUS_SCHEME_RE.test(value)) return false;
  // Must be a relative same-origin path beginning with a single "/".
  if (!value.startsWith("/")) return false;

  const lower = value.toLowerCase();
  const pathOnly = lower.split(/[?#]/, 1)[0];
  if (pathOnly === "/") return false;
  if (AUTH_LOOP_EXACT.has(pathOnly)) return false;
  for (const prefix of AUTH_LOOP_PREFIXES) {
    if (lower.startsWith(prefix)) return false;
  }
  return true;
}

/**
 * Extract every nested `next` param value (query + fragment) using
 * URLSearchParams, which decodes percent-encoded octets exactly once.
 */
function extractNestedNextValues(value: string): string[] {
  const out: string[] = [];
  // Query string
  const qIdx = value.indexOf("?");
  if (qIdx >= 0) {
    const afterQ = value.slice(qIdx + 1);
    const hashIdx = afterQ.indexOf("#");
    const queryPart = hashIdx >= 0 ? afterQ.slice(0, hashIdx) : afterQ;
    try {
      const params = new URLSearchParams(queryPart);
      for (const v of params.getAll("next")) out.push(v);
    } catch {
      /* ignore malformed */
    }
  }
  // Fragment
  const hIdx = value.indexOf("#");
  if (hIdx >= 0) {
    const fragment = value.slice(hIdx + 1);
    try {
      const params = new URLSearchParams(fragment);
      for (const v of params.getAll("next")) out.push(v);
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * Recursively verify a value and every nested `next=` payload found in its
 * query string and fragment. Depth is bounded to prevent pathological input;
 * a seen-set stops cycles.
 */
function isDeeplySafe(
  value: string,
  depth: number,
  seen: Set<string>,
): boolean {
  if (depth > MAX_NESTED_DEPTH) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (!isShallowSafe(value)) return false;
  for (const nested of extractNestedNextValues(value)) {
    // Nested next values are themselves untrusted: they must satisfy the
    // full same policy (including no leading/trailing whitespace).
    if (!isDeeplySafe(nested, depth + 1, seen)) return false;
  }
  return true;
}

export function resolveSafeNext(
  raw: unknown,
  fallback: string = DEFAULT_SAFE_NEXT,
): string {
  if (typeof raw !== "string") return fallback;
  if (!isDeeplySafe(raw, 0, new Set<string>())) return fallback;
  return raw;
}

/**
 * Convenience: pull `next` from a URLSearchParams-like object and resolve it.
 */
export function readSafeNextParam(
  params: { get(name: string): string | null } | null | undefined,
  fallback: string = DEFAULT_SAFE_NEXT,
): string {
  if (!params) return fallback;
  const raw = params.get("next");
  return resolveSafeNext(raw, fallback);
}
