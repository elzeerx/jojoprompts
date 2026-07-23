// v2-upayments-refund (admin-only)
// Actions:
//   POST { action: "create", order_id, idempotency_key, allocations:[{order_item_id,amount_fils}], reason? }
//   POST { action: "status", refund_id }
//
// Create: v2_create_refund_request → v2_claim_refund_submission → POST /create-refund →
//         v2_record_upayments_refund_response (approved/submitted only, never processed).
// Status: v2_claim_refund_status_check → GET /check-refund/{provider_order_id} →
//         v2_apply_verified_refund on REFUNDED/PROCESSED/SUCCESS; failure on definitive fail.

import {
  jsonResponse, methodGuard, readBoundedJson, requireAdmin,
  serviceClient, loadUpaymentsConfig, providerFetch,
  extractRefundStatusFields, normalizeStatusResult, kwdDecimalToFils,
  filsToKwdDecimal, sanitizeProviderPayload, eventIdForRefund,
} from "../_shared/v2Upayments.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CreateBody = {
  action: "create";
  order_id: string;
  idempotency_key: string;
  allocations: { order_item_id: string; amount_fils: number }[];
  reason?: string;
};
type StatusBody = { action: "status"; refund_id: string };

function isCreate(b: unknown): b is CreateBody {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  if (o.action !== "create") return false;
  if (typeof o.order_id !== "string" || !UUID_RE.test(o.order_id)) return false;
  if (typeof o.idempotency_key !== "string" || o.idempotency_key.length < 1 || o.idempotency_key.length > 120) return false;
  if (!Array.isArray(o.allocations) || o.allocations.length === 0 || o.allocations.length > 100) return false;
  for (const a of o.allocations) {
    if (!a || typeof a !== "object") return false;
    const aa = a as Record<string, unknown>;
    if (typeof aa.order_item_id !== "string" || !UUID_RE.test(aa.order_item_id)) return false;
    if (typeof aa.amount_fils !== "number" || !Number.isInteger(aa.amount_fils) || aa.amount_fils <= 0) return false;
  }
  if (o.reason != null && (typeof o.reason !== "string" || o.reason.length > 512)) return false;
  return true;
}
function isStatus(b: unknown): b is StatusBody {
  if (!b || typeof b !== "object") return false;
  const o = b as Record<string, unknown>;
  return o.action === "status" && typeof o.refund_id === "string" && UUID_RE.test(o.refund_id);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const g = methodGuard(req, "POST");
  if (g) return g;

  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const parsed = await readBoundedJson(req);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, origin);
  const body = parsed.body;

  const svc = serviceClient();

  if (isCreate(body)) {
    // 1. Create refund row (server-side).
    const { data: cr, error: cErr } = await svc.rpc("v2_create_refund_request", {
      p_admin_actor_id: auth.userId,
      p_order_id: body.order_id,
      p_idempotency_key: body.idempotency_key,
      p_allocations: body.allocations,
      p_reason: body.reason ?? null,
    });
    if (cErr) return jsonResponse({ error: cErr.message }, 400, origin);
    const c = (cr ?? {}) as Record<string, unknown>;
    if (c.ok === false) return jsonResponse(c, 409, origin);
    const refundId = String(c.refund_id ?? c.id ?? "");
    if (!refundId) return jsonResponse({ error: "create_failed" }, 500, origin);

    // 2. Claim before POST /create-refund.
    const { data: claim, error: clErr } = await svc.rpc("v2_claim_refund_submission", {
      p_admin_actor_id: auth.userId, p_refund_id: refundId,
    });
    if (clErr) return jsonResponse({ error: clErr.message }, 400, origin);
    const cl = (claim ?? {}) as Record<string, unknown>;
    if (cl.claimed !== true) {
      return jsonResponse({ error: cl.error ?? "claim_failed", refund_id: refundId }, 409, origin);
    }

    const cfg = loadUpaymentsConfig();
    if (!cfg) {
      await svc.rpc("v2_record_refund_submission_unknown", {
        p_admin_actor_id: auth.userId, p_refund_id: refundId,
        p_http_status: null, p_sanitized_payload: { kind: "provider_disabled" },
      });
      return jsonResponse({ error: "provider_disabled", refund_id: refundId }, 503, origin);
    }

    const originalProviderOrderId = String(cl.original_provider_order_id ?? "");
    if (!originalProviderOrderId) {
      await svc.rpc("v2_record_refund_submission_unknown", {
        p_admin_actor_id: auth.userId, p_refund_id: refundId,
        p_http_status: null, p_sanitized_payload: { kind: "missing_original_provider_id" },
      });
      return jsonResponse({ error: "recovery_required", reason: "missing_original_provider_id" }, 502, origin);
    }
    const amountFils = Number(cl.amount_fils);
    const amountDecimal = filsToKwdDecimal(amountFils);

    const providerBody = {
      order_id: originalProviderOrderId,
      amount: amountDecimal,
      currency: "KWD",
      reason: body.reason ?? "customer_refund",
    };
    const res = await providerFetch(cfg, "/create-refund", { method: "POST", body: providerBody });
    if (res.kind !== "ok") {
      await svc.rpc("v2_record_refund_submission_unknown", {
        p_admin_actor_id: auth.userId, p_refund_id: refundId,
        p_http_status: res.kind === "http_error" ? res.status : (res.kind === "invalid_response" ? res.status ?? null : null),
        p_sanitized_payload: { kind: `provider_${res.kind}` },
      });
      return jsonResponse({ error: "recovery_required", reason: res.kind }, 502, origin);
    }

    const rex = extractRefundStatusFields(res.json);
    const providerRefundOrderId = rex.providerRefundOrderId;
    if (!providerRefundOrderId) {
      await svc.rpc("v2_record_refund_submission_unknown", {
        p_admin_actor_id: auth.userId, p_refund_id: refundId,
        p_http_status: res.status,
        p_sanitized_payload: sanitizeProviderPayload("refund_create_missing_id", res.json, res.status),
      });
      return jsonResponse({ error: "recovery_required", reason: "missing_provider_refund_id" }, 502, origin);
    }

    const evtId = eventIdForRefund(refundId, providerRefundOrderId);
    const { error: rrErr } = await svc.rpc("v2_record_upayments_refund_response", {
      p_admin_actor_id: auth.userId, p_refund_id: refundId,
      p_provider_refund_order_id: providerRefundOrderId,
      p_external_event_id: evtId,
      p_sanitized_payload: sanitizeProviderPayload("refund_create", res.json, res.status),
    });
    if (rrErr) return jsonResponse({ error: rrErr.message }, 500, origin);

    return jsonResponse({ ok: true, refund_id: refundId, status: "approved" }, 200, origin);
  }

  if (isStatus(body)) {
    const { data: claim, error: clErr } = await svc.rpc("v2_claim_refund_status_check", {
      p_admin_actor_id: auth.userId, p_refund_id: body.refund_id,
    });
    if (clErr) return jsonResponse({ error: clErr.message }, 400, origin);
    const cl = (claim ?? {}) as Record<string, unknown>;
    if (cl.ok === false && cl.error === "backoff_active") {
      return jsonResponse({ status: "pending", reason: "backoff_active" }, 202, origin);
    }
    if (cl.claimed !== true) return jsonResponse({ error: "claim_failed" }, 409, origin);

    const cfg = loadUpaymentsConfig();
    if (!cfg) return jsonResponse({ status: "pending", reason: "provider_disabled" }, 202, origin);

    const providerRefundOrderId = String(cl.provider_refund_order_id);
    const refundId = String(cl.refund_id);
    const amountFils = Number(cl.amount_fils);

    const res = await providerFetch(cfg, `/check-refund/${encodeURIComponent(providerRefundOrderId)}`, { method: "GET" });
    if (res.kind !== "ok") return jsonResponse({ status: "pending", reason: res.kind }, 202, origin);

    const rex = extractRefundStatusFields(res.json);
    if (rex.providerRefundOrderId && rex.providerRefundOrderId !== providerRefundOrderId) {
      return jsonResponse({ status: "pending", reason: "provider_refund_id_mismatch" }, 202, origin);
    }
    const verdict = normalizeStatusResult(rex.result);
    const sanitized = sanitizeProviderPayload("refund_status", res.json, res.status);
    const evtId = eventIdForRefund(refundId, providerRefundOrderId);

    if (verdict.verdict === "captured") {
      if (!rex.currency || rex.currency.toUpperCase() !== "KWD") {
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
      const { error: aErr } = await svc.rpc("v2_apply_verified_refund", {
        p_admin_actor_id: auth.userId, p_refund_id: refundId,
        p_provider_refund_order_id: providerRefundOrderId,
        p_result: verdict.normalized, p_external_event_id: evtId,
        p_sanitized_payload: sanitized,
      });
      if (aErr) return jsonResponse({ error: aErr.message }, 500, origin);
      return jsonResponse({ status: "processed", refund_id: refundId }, 200, origin);
    }

    if (verdict.verdict === "failed" || verdict.verdict === "cancelled") {
      const { error: fErr } = await svc.rpc("v2_mark_verified_refund_failure", {
        p_admin_actor_id: auth.userId, p_refund_id: refundId,
        p_provider_refund_order_id: providerRefundOrderId,
        p_result: verdict.normalized, p_external_event_id: evtId,
        p_sanitized_payload: sanitized,
      });
      if (fErr) return jsonResponse({ error: fErr.message }, 500, origin);
      return jsonResponse({ status: "failed", refund_id: refundId }, 200, origin);
    }

    return jsonResponse({ status: "pending", reason: verdict.verdict }, 202, origin);
  }

  return jsonResponse({ error: "invalid_body" }, 400, origin);
});
