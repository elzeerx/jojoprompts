/**
 * V2 safe-next resolver.
 *
 * Pure, framework-free. Accepts an untrusted `next` value (typically from a
 * URL query string) and returns either a safe same-origin path (starting with
 * a single "/") or a fallback (default "/explore").
 *
 * Rejects:
 *   - external URLs (http:, https:, ftp:, …)
 *   - protocol-relative URLs ("//evil.com")
 *   - javascript:, data:, vbscript: and other dangerous pseudo-protocols
 *   - malformed / empty values
 *   - values that would cause a login/reset auth loop (/login, /signup,
 *     /reset-password, /email-confirmation, /auth/*, /magic-link-sent)
 *
 * Accepts internal V2 destinations preserving query strings, e.g.
 *   /checkout, /cart, /library, /orders, /account, /resources/foo?x=1
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

const DANGEROUS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export function resolveSafeNext(
  raw: unknown,
  fallback: string = DEFAULT_SAFE_NEXT,
): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value) return fallback;

  // Reject protocol-relative ("//x"), backslash-tricks ("/\\x"), and absolute URLs.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("\\")) return fallback;

  // Reject any scheme-bearing input (http:, https:, javascript:, data:, etc.).
  if (DANGEROUS_SCHEME_RE.test(value)) return fallback;

  // Must be a relative same-origin path beginning with a single "/".
  if (!value.startsWith("/")) return fallback;

  // Normalize for loop / equality checks.
  const lower = value.toLowerCase();
  // Exact match on an auth page (with or without trailing slash) or any
  // path under /auth/… would cause a redirect loop back into the flow.
  if (
    lower === "/login" ||
    lower === "/signup" ||
    lower === "/reset-password" ||
    lower === "/email-confirmation" ||
    lower === "/magic-link-sent" ||
    lower === "/auth" ||
    lower === "/"
  ) {
    // "/" alone is safe-but-useless as a post-auth destination; prefer fallback.
    if (lower === "/") return fallback;
    return fallback;
  }
  for (const prefix of AUTH_LOOP_PREFIXES) {
    if (lower.startsWith(prefix)) return fallback;
  }

  return value;
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
