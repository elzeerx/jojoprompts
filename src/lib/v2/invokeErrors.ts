/**
 * Safe helpers for parsing errors returned by supabase.functions.invoke().
 *
 * Non-2xx responses from Supabase Edge Functions surface as
 * FunctionsHttpError where the JSON body lives on `error.context` (a Response).
 * We prefer:
 *   1) data.error when the invoke resolved 2xx-ish and returned a body,
 *   2) error.context.clone().json().error as a fallback for non-2xx,
 * and clamp to an allowlist so raw provider or RPC messages never leak.
 */

export const ALLOWED_ERROR_CODES = new Set<string>([
  "provider_disabled",
  "configuration_unavailable",
  "overlap_pending_order",
  "ownership_conflict",
  "recovery_required",
  "invalid_body",
  "not_authenticated",
  "insufficient_permissions",
  "not_found",
  "no_attempt",
  "claim_failed",
  "backoff_active",
  "global_backoff",
  "external_event_conflict",
  "discount_invalid",
  "cart_empty",
  "product_unavailable",
  // Refund-specific codes
  "not_eligible",
  "duplicate_idempotency_key",
  "amount_mismatch",
  "allocation_invalid",
  "refund_not_found",
  "refund_conflict",
  "server_error",
  // Admin receipt-resend codes (v2-admin-resend-order-receipt)
  "invalid_arguments",
  "invalid_reason",
  "invalid_order_id",
  "unexpected_field",
  "body_too_large",
  "method_not_allowed",
  "unauthorized",
  "forbidden",
  "order_not_found",
  "order_not_eligible",
  "missing_recipient",
  "pending_exists",
  "cooldown_active",
  "order_cap_exceeded",
  "admin_cap_exceeded",
  "order_load_failed",
  "resend_send_failed",
  "resend_request_failed",
  "reconciliation_required",
  "claim_lost",
]);

async function extractFromResponse(res: unknown): Promise<string | undefined> {
  if (!res || typeof (res as Response).clone !== "function") return undefined;
  try {
    const clone = (res as Response).clone();
    const body = (await clone.json()) as { error?: unknown } | null;
    const code = body?.error;
    if (typeof code === "string" && ALLOWED_ERROR_CODES.has(code)) return code;
  } catch {
    // Ignore parse failures — response may not be JSON.
  }
  return undefined;
}

/**
 * Extract an allowlisted error code from a Supabase edge-function invocation
 * result. Returns undefined when no known code is present.
 */
export async function extractInvokeErrorCode(
  data: unknown,
  error: unknown,
): Promise<string | undefined> {
  const dataCode = (data as { error?: unknown } | null | undefined)?.error;
  if (typeof dataCode === "string" && ALLOWED_ERROR_CODES.has(dataCode)) {
    return dataCode;
  }
  const ctx = (error as { context?: unknown } | null | undefined)?.context;
  const fromCtx = await extractFromResponse(ctx);
  if (fromCtx) return fromCtx;
  return undefined;
}

/**
 * Strict validator for a UPayments hosted checkout URL. Rejects non-HTTPS,
 * credential URLs, non-default ports, and any host that is not exactly
 * upayments.com or a *.upayments.com subdomain.
 */
export function isValidUpaymentsCheckoutUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username !== "" || url.password !== "") return false;
  if (url.port !== "" && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  if (host === "upayments.com") return true;
  if (host.endsWith(".upayments.com")) return true;
  return false;
}
