// Pure decision helpers for v2-admin-resend-order-receipt.
// No I/O. Safe to import from Bun-based contract tests as well as Deno.

export const REASON_MIN = 3;
export const REASON_MAX = 300;
export const BODY_BYTES_MAX = 2048;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(x: unknown): x is string {
  return typeof x === "string" && UUID_RE.test(x);
}

export function normalizeReason(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) return null;
  return trimmed;
}

export type ParseResendBodyResult =
  | { ok: true; order_id: string; reason: string }
  | { ok: false; code: string };

export type ParseReceiptResendCommandResult =
  | { ok: true; mode: "create"; order_id: string; reason: string }
  | { ok: true; mode: "reconcile"; request_id: string }
  | {
      ok: true;
      mode: "resolve";
      request_id: string;
      resolution: "sent" | "failed";
      reason: string;
    }
  | { ok: false; code: string };

/**
 * Strict body parser. Accepts EXACTLY `{ order_id, reason }`. Any extra key
 * (email/amount/items/recipient/etc.) is a hard error — the server never
 * accepts client-supplied recipient/amount/items overrides.
 */
export function parseResendBody(raw: unknown): ParseResendBodyResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, code: "invalid_body" };
  }
  const rec = raw as Record<string, unknown>;
  const allowed = new Set(["order_id", "reason"]);
  for (const key of Object.keys(rec)) {
    if (!allowed.has(key)) return { ok: false, code: "unexpected_field" };
  }
  const order_id = rec.order_id;
  const reason = rec.reason;
  if (!isValidUuid(order_id)) return { ok: false, code: "invalid_order_id" };
  const normalized = normalizeReason(reason);
  if (normalized === null) return { ok: false, code: "invalid_reason" };
  return { ok: true, order_id, reason: normalized };
}

/**
 * Admin endpoint command parser. It accepts exactly one of:
 *   - `{ order_id, reason }` to create a new audited resend request
 *   - `{ request_id }` to reconcile the SAME ambiguous request with the SAME
 *     Resend idempotency key and persisted provider payload
 *   - `{ request_id, resolution, reason }` to record a manual provider review
 *     after automatic same-key reconciliation is no longer safe
 */
export function parseReceiptResendCommand(
  raw: unknown,
): ParseReceiptResendCommandResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, code: "invalid_body" };
  }
  const rec = raw as Record<string, unknown>;
  const keys = Object.keys(rec);
  if (keys.length === 1 && keys[0] === "request_id") {
    if (!isValidUuid(rec.request_id)) {
      return { ok: false, code: "invalid_request_id" };
    }
    return { ok: true, mode: "reconcile", request_id: rec.request_id };
  }
  const resolveKeys = new Set(["request_id", "resolution", "reason"]);
  if (keys.length === 3 && keys.every((key) => resolveKeys.has(key))) {
    if (!isValidUuid(rec.request_id)) {
      return { ok: false, code: "invalid_request_id" };
    }
    if (rec.resolution !== "sent" && rec.resolution !== "failed") {
      return { ok: false, code: "invalid_resolution" };
    }
    const reason = normalizeReason(rec.reason);
    if (!reason) return { ok: false, code: "invalid_reason" };
    return {
      ok: true,
      mode: "resolve",
      request_id: rec.request_id,
      resolution: rec.resolution,
      reason,
    };
  }

  const created = parseResendBody(raw);
  if (!created.ok) return created;
  return { ok: true, mode: "create", ...created };
}

/**
 * Map RPC/RAISE EXCEPTION messages to stable client-safe error codes/statuses.
 * Never surfaces provider or DB internals verbatim.
 */
export function mapCreateRpcError(msg: string): { code: string; status: number } {
  const m = (msg || "").toLowerCase();
  if (m.includes("forbidden")) return { code: "forbidden", status: 403 };
  if (m.includes("invalid_arguments") || m.includes("reason_required")) {
    return { code: "invalid_arguments", status: 400 };
  }
  if (m.includes("reason_invalid_length")) return { code: "invalid_reason", status: 400 };
  if (m.includes("order_not_found")) return { code: "order_not_found", status: 404 };
  if (m.includes("order_not_eligible")) return { code: "order_not_eligible", status: 409 };
  if (m.includes("missing_recipient")) return { code: "missing_recipient", status: 409 };
  if (m.includes("pending_exists")) return { code: "pending_exists", status: 409 };
  if (m.includes("uniq_v2_receipt_resend_active")) {
    return { code: "pending_exists", status: 409 };
  }
  if (m.includes("cooldown_active")) return { code: "cooldown_active", status: 429 };
  if (m.includes("order_cap_exceeded")) return { code: "order_cap_exceeded", status: 429 };
  if (m.includes("admin_cap_exceeded")) return { code: "admin_cap_exceeded", status: 429 };
  return { code: "resend_request_failed", status: 500 };
}
