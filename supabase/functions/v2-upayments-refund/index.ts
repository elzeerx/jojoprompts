// v2-upayments-refund (admin-only)
// Actions:
//   POST { action: "create", order_id, idempotency_key,
//          allocations:[{order_item_id, amount_fils}], reason? }
//   POST { action: "status", refund_id }
//
// Documented UPayments create-refund body:
//   { orderId, totalPrice, reference, refundReason }
// Documented response fields we persist separately:
//   data.orderId       => refunds.provider_reference        (check id)
//   data.refundOrderId => refunds.provider_refund_order_id  (refund order id)
// Refund status poll:
//   GET /check-refund/{provider_reference}

import {
  jsonResponse, methodGuard, readBoundedJson, hasOnlyAllowedKeys,
  requireAdmin, serviceClient, loadUpaymentsConfig,
  providerFetch, providerSuccessFlag,
  extractRefundResponseFields, normalizeRefundStatus, kwdDecimalToFils,
  filsToKwdDecimal, filsToKwdNumber, sanitizeProviderPayload, eventIdForRefund,
  localRefundReference, safeRpcError,
} from "../_shared/v2Upayments.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CREATE_KEYS = ["action","order_id","idempotency_key","allocations","reason"];
const STATUS_KEYS = ["action","refund_id"];

type CreateBody = {
  action: "create";
  order_id: string;
  idempotency_key: string;
  allocations: { order_item_id: string; amount_fils: number }[];
  reason?: string;
};
type StatusBody = { action: "status"; refund_id: string };

function isCreate(b: unknown): b is CreateBody {
  if (!b || typeof b !== "object" || Array.isArray(b)) return false;
  const o = b as Record<string, unknown>;
  if (o.action !== "create") return false;
  if (!hasOnlyAllowedKeys(o, CREATE_KEYS)) return false;
  if (typeof o.order_id !== "string" || !UUID_RE.test(o.order_id)) return false;
  if (typeof o.idempotency_key !== "string"
      || o.idempotency_key.length < 1 || o.idempotency_key.length > 120) return false;
  if (!Array.isArray(o.allocations)
      || o.allocations.length === 0 || o.allocations.length > 100) return false;
  for (const a of o.allocations) {
    if (!a || typeof a !== "object" || Array.isArray(a)) return false;
    const aa = a as Record<string, unknown>;
    if (!hasOnlyAllowedKeys(aa, ["order_item_id","amount_fils"])) return false;
    if (typeof aa.order_item_id !== "string" || !UUID_RE.test(aa.order_item_id)) return false;
    if (typeof aa.amount_fils !== "number"
        || !Number.isInteger(aa.amount_fils) || aa.amount_fils <= 0) return false;
  }
  if (o.reason != null && (typeof o.reason !== "string" || o.reason.length > 255)) return false;
  return true;
}
function isStatus(b: unknown): b is StatusBody {
  if (!b || typeof b !== "object" || Array.isArray(b)) return false;
  const o = b as Record<string, unknown>;
  if (o.action !== "status") return false;
  if (!hasOnlyAllowedKeys(o, STATUS_KEYS)) return false;
  return typeof o.refund_id === "string" && UUID_RE.test(o.refund_id);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const g = methodGuard(req, "POST");
  if (g) return g;

  // 1. Auth + body validation (no DB mutations yet).
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const parsed = await readBoundedJson(req);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, origin);
  const body = parsed.body;

  const isCreateBody = isCreate(body);
  const isStatusBody = !isCreateBody && isStatus(body);
  if (!isCreateBody && !isStatusBody) {
    return jsonResponse({ error: "invalid_body" }, 400, origin);
  }

  // 2. Feature-flag gate BEFORE any DB mutation.
  const cfg = loadUpaymentsConfig();
  if (!cfg) return jsonResponse({ error: "provider_disabled" }, 503, origin);

  const svc = serviceClient();

  // ------------------------------------------------------------- CREATE
  if (isCreateBody) {
    const create = body as CreateBody;

    const { data: cr, error: cErr } = await svc.rpc("v2_create_refund_request", {
      p_admin_actor_id: auth.userId,
      p_order_id: create.order_id,
      p_idempotency_key: create.idempotency_key,
      p_allocations: create.allocations,
      p_reason: create.reason ?? null,
    });
    if (cErr) return jsonResponse({ error: safeRpcError(cErr) }, 400, origin);
    const c = (cr ?? {}) as Record<string, unknown>;
    if (c.ok === false) return jsonResponse(c, 409, origin);
    const refundId = String(c.refund_id ?? c.id ?? "");
    if (!refundId) return jsonResponse({ error: "server_error" }, 500, origin);

    const { data: claim, error: clErr } = await svc.rpc("v2_claim_refund_submission", {
      p_admin_actor_id: auth.userId, p_refund_id: refundId,
    });
    if (clErr) return jsonResponse({ error: safeRpcError(clErr) }, 400, origin);
    const cl = (claim ?? {}) as Record<string, unknown>;
    if (cl.claimed !== true) {
      return jsonResponse({ error: "claim_failed", refund_id: refundId }, 409, origin);
    }

    const originalProviderOrderId = String(cl.original_provider_order_id ?? "");
    if (!originalProviderOrderId) {
      await svc.rpc("v2_record_refund_submission_unknown", {
        p_admin_actor_id: auth.userId, p_refund_id: refundId,
        p_http_status: null,
        p_sanitized_payload: { kind: "missing_original_provider_id" },
      });
      return jsonResponse({ error: "recovery_required",
        reason: "missing_original_provider_id" }, 502, origin);
    }
    const amountFils = Number(cl.amount_fils);
    const amountDecimal = filsToKwdDecimal(amountFils);
    const amountNumber = filsToKwdNumber(amountFils);
    const reference = localRefundReference(refundId);

    // Documented body — totalPrice MUST be a JSON number (float), not a string.
    // UPayments returns HTTP 422 for stringified amounts.
    const providerBody: Record<string, unknown> = {
      orderId: originalProviderOrderId,
      totalPrice: amountNumber,
      reference,
    };
    if (create.reason && create.reason.trim().length > 0) {
      providerBody.refundReason = create.reason.slice(0, 255);
    }

    const res = await providerFetch(cfg, "/create-refund",
      { method: "POST", body: providerBody });

    if (res.kind !== "ok") {
      await svc.rpc("v2_record_refund_submission_unknown", {
        p_admin_actor_id: auth.userId, p_refund_id: refundId,
        p_http_status: res.kind === "http_error" ? res.status
          : (res.kind === "invalid_response" ? res.status ?? null : null),
        p_sanitized_payload: { kind: `provider_${res.kind}` },
      });
      return jsonResponse({ error: "recovery_required", reason: res.kind }, 502, origin);
    }

    if (!providerSuccessFlag(res.json)) {
      await svc.rpc("v2_record_refund_submission_unknown", {
        p_admin_actor_id: auth.userId, p_refund_id: refundId,
        p_http_status: res.status,
        p_sanitized_payload: sanitizeProviderPayload("refund_status_false", res.json, res.status),
      });
      return jsonResponse({ error: "recovery_required", reason: "provider_rejected" }, 502, origin);
    }

    const rex = extractRefundResponseFields(res.json);
    if (!rex.providerReference || !rex.providerRefundOrderId) {
      await svc.rpc("v2_record_refund_submission_unknown", {
        p_admin_actor_id: auth.userId, p_refund_id: refundId,
        p_http_status: res.status,
        p_sanitized_payload: sanitizeProviderPayload("refund_create_missing_ids", res.json, res.status),
      });
      return jsonResponse({ error: "recovery_required",
        reason: "missing_provider_refund_ids" }, 502, origin);
    }

    const evtId = eventIdForRefund(refundId, "create_authorized", rex.providerRefundOrderId);
    const { error: rrErr } = await svc.rpc("v2_record_upayments_refund_response", {
      p_admin_actor_id: auth.userId, p_refund_id: refundId,
      p_provider_reference: rex.providerReference,
      p_provider_refund_order_id: rex.providerRefundOrderId,
      p_external_event_id: evtId,
      p_sanitized_payload: sanitizeProviderPayload("refund_create", res.json, res.status),
    });
    if (rrErr) return jsonResponse({ error: safeRpcError(rrErr) }, 500, origin);

    return jsonResponse({ ok: true, refund_id: refundId, status: "approved" }, 200, origin);
  }

  // ------------------------------------------------------------- STATUS
  const st = body as StatusBody;

  const { data: claim, error: clErr } = await svc.rpc("v2_claim_refund_status_check", {
    p_admin_actor_id: auth.userId, p_refund_id: st.refund_id,
  });
  if (clErr) return jsonResponse({ error: safeRpcError(clErr) }, 400, origin);
  const cl = (claim ?? {}) as Record<string, unknown>;
  if (cl.ok === false && cl.error === "backoff_active") {
    return jsonResponse({ status: "pending", reason: "backoff_active" }, 202, origin);
  }
  if (cl.ok === false && cl.error === "global_backoff") {
    return jsonResponse({ status: "pending", reason: "global_backoff" }, 202, origin);
  }
  if (cl.claimed !== true) return jsonResponse({ error: "claim_failed" }, 409, origin);

  const providerReference = String(cl.provider_reference);
  const providerRefundOrderId = String(cl.provider_refund_order_id);
  const refundId = String(cl.refund_id);
  const amountFils = Number(cl.amount_fils);

  // Poll using the CHECK id (provider_reference == create-refund data.orderId).
  const res = await providerFetch(cfg,
    `/check-refund/${encodeURIComponent(providerReference)}`, { method: "GET" });
  if (res.kind !== "ok") {
    return jsonResponse({ status: "pending", reason: res.kind }, 202, origin);
  }
  if (!providerSuccessFlag(res.json)) {
    return jsonResponse({ status: "pending", reason: "provider_rejected" }, 202, origin);
  }

  const rex = extractRefundResponseFields(res.json);
  // Any returned check/refund IDs must equal what we already stored.
  if (rex.providerReference && rex.providerReference !== providerReference) {
    return jsonResponse({ status: "pending", reason: "provider_reference_mismatch" }, 202, origin);
  }
  if (rex.providerRefundOrderId && rex.providerRefundOrderId !== providerRefundOrderId) {
    return jsonResponse({ status: "pending", reason: "provider_refund_id_mismatch" }, 202, origin);
  }

  const verdict = normalizeRefundStatus(rex.result);
  const sanitized = sanitizeProviderPayload("refund_status", res.json, res.status);

  if (verdict.verdict === "processed") {
    if (rex.currency && rex.currency.toUpperCase() !== "KWD") {
      return jsonResponse({ status: "pending", reason: "currency_mismatch" }, 202, origin);
    }
    if (rex.amountRaw) {
      let providerAmount: number;
      try { providerAmount = kwdDecimalToFils(rex.amountRaw); }
      catch { return jsonResponse({ status: "pending", reason: "amount_unparseable" }, 202, origin); }
      if (providerAmount !== amountFils) {
        return jsonResponse({ status: "pending", reason: "amount_mismatch" }, 202, origin);
      }
    }

    // Atomic correlated apply — verifies BOTH provider ids under per-user lock
    // and invokes v2_apply_verified_refund in the same transaction.
    const evtId = eventIdForRefund(refundId, "status_processed", providerRefundOrderId);
    const { error: aErr } = await svc.rpc("v2_apply_verified_refund_correlated", {
      p_admin_actor_id: auth.userId, p_refund_id: refundId,
      p_provider_reference: providerReference,
      p_provider_refund_order_id: providerRefundOrderId,
      p_result: verdict.normalized, p_external_event_id: evtId,
      p_sanitized_payload: sanitized,
    });
    if (aErr) return jsonResponse({ error: safeRpcError(aErr) }, 500, origin);
    return jsonResponse({ status: "processed", refund_id: refundId }, 200, origin);
  }

  if (verdict.verdict === "failed") {
    const evtId = eventIdForRefund(refundId, "status_failed", providerRefundOrderId);
    const { error: fErr } = await svc.rpc("v2_mark_verified_refund_failure_correlated", {
      p_admin_actor_id: auth.userId, p_refund_id: refundId,
      p_provider_reference: providerReference,
      p_provider_refund_order_id: providerRefundOrderId,
      p_result: verdict.normalized, p_external_event_id: evtId,
      p_sanitized_payload: sanitized,
    });
    if (fErr) return jsonResponse({ error: safeRpcError(fErr) }, 500, origin);
    return jsonResponse({ status: "failed", refund_id: refundId }, 200, origin);
  }

  // pending / unknown: never revoke, never mutate credit/ownership.
  return jsonResponse({ status: "pending", reason: verdict.verdict }, 202, origin);
});
