// v2-upayments-status
// POST { order_id } — owner-only.
//
// Order:
//   1) validate body + auth
//   2) load config → if disabled, return pending/provider_disabled with ZERO DB mutation
//   3) find latest upayments attempt → v2_claim_payment_status_check
//   4) GET /get-payment-status/{track_id}  OR  /get-payment-status?session_id=...
//   5) verify official status===true, merchant reference, lookup identifier,
//      amount/currency BEFORE settle/fail. Never trusts redirect URLs.

import {
  jsonResponse, methodGuard, readBoundedJson, hasOnlyAllowedKeys, requireUser,
  serviceClient, loadUpaymentsConfig, providerFetch, providerSuccessFlag,
  extractStatusFields, normalizePaymentStatus, kwdDecimalToFils,
  sanitizeProviderPayload, eventIdForStatus, safeRpcError,
} from "../_shared/v2Upayments.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validBody(b: unknown): b is { order_id: string } {
  if (!b || typeof b !== "object" || Array.isArray(b)) return false;
  const o = b as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(o, ["order_id"])) return false;
  return typeof o.order_id === "string" && UUID_RE.test(o.order_id);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const g = methodGuard(req, "POST");
  if (g) return g;

  // 1. Auth + validation.
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const parsed = await readBoundedJson(req);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, origin);
  if (!validBody(parsed.body)) return jsonResponse({ error: "invalid_body" }, 400, origin);
  const orderId = parsed.body.order_id;

  // 2. Feature-flag gate BEFORE any DB mutation.
  const cfg = loadUpaymentsConfig();
  if (!cfg) {
    return jsonResponse({ status: "pending", reason: "provider_disabled" }, 202, origin);
  }

  const svc = serviceClient();

  // 3. Lookup latest upayments attempt (read-only, ownership enforced by claim).
  const { data: att, error: aErr } = await svc
    .from("payment_attempts")
    .select("id")
    .eq("order_id", orderId)
    .eq("provider", "upayments")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aErr) return jsonResponse({ error: "server_error" }, 500, origin);
  if (!att) return jsonResponse({ error: "no_attempt" }, 404, origin);

  const { data: claim, error: clErr } = await svc.rpc("v2_claim_payment_status_check", {
    p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: att.id,
    p_allow_admin: false,
  });
  if (clErr) return jsonResponse({ error: safeRpcError(clErr) }, 400, origin);
  const cl = (claim ?? {}) as Record<string, unknown>;
  if (cl.ok === false && cl.error === "backoff_active") {
    return jsonResponse({ status: "pending", reason: "backoff_active",
      next_check_after: cl.next_check_after }, 202, origin);
  }
  if (cl.ok === false && cl.error === "global_backoff") {
    return jsonResponse({ status: "pending", reason: "global_backoff" }, 202, origin);
  }
  if (cl.claimed !== true) return jsonResponse({ error: "claim_failed" }, 409, origin);

  const trackId = cl.track_id ? String(cl.track_id) : null;
  const sessionId = cl.session_id ? String(cl.session_id) : null;
  const providerOrderId = cl.provider_order_id ? String(cl.provider_order_id) : null;
  const merchantRef = String(cl.merchant_reference);
  const amountFils = Number(cl.amount_fils);
  const attemptId = String(cl.attempt_id);

  // 4. Query provider. Fix: no double slash before session_id form.
  const path = trackId
    ? `/get-payment-status/${encodeURIComponent(trackId)}`
    : `/get-payment-status?session_id=${encodeURIComponent(sessionId ?? "")}`;

  const res = await providerFetch(cfg, path, { method: "GET" });
  if (res.kind !== "ok") {
    return jsonResponse({ status: "pending", reason: res.kind }, 202, origin);
  }
  if (!providerSuccessFlag(res.json)) {
    return jsonResponse({ status: "pending", reason: "provider_rejected" }, 202, origin);
  }

  const ex = extractStatusFields(res.json);
  const verdict = normalizePaymentStatus(ex.result);

  // 5. Identifier correlation. Merchant reference MUST match.
  if (!ex.merchantReference || ex.merchantReference !== merchantRef) {
    return jsonResponse({ status: "pending", reason: "merchant_reference_mismatch" }, 202, origin);
  }
  // The lookup identifier we used MUST match provider echo when returned.
  if (trackId) {
    if (!ex.trackId || ex.trackId !== trackId) {
      return jsonResponse({ status: "pending", reason: "track_id_mismatch" }, 202, origin);
    }
  } else if (sessionId) {
    if (!ex.sessionId || ex.sessionId !== sessionId) {
      return jsonResponse({ status: "pending", reason: "session_id_mismatch" }, 202, origin);
    }
  }
  // If we already had a provider_order_id, echo must match. If we didn't,
  // use the newly returned one when settling.
  if (providerOrderId && ex.providerOrderId && ex.providerOrderId !== providerOrderId) {
    return jsonResponse({ status: "pending", reason: "provider_order_id_mismatch" }, 202, origin);
  }
  const effectiveProviderOrderId = providerOrderId ?? ex.providerOrderId ?? null;

  const sanitized = sanitizeProviderPayload("payment_status", res.json, res.status);
  const evtId = eventIdForStatus(orderId,
    effectiveProviderOrderId ?? ex.trackId ?? trackId, verdict.verdict);

  if (verdict.verdict === "captured") {
    if (!ex.currency || ex.currency.toUpperCase() !== "KWD") {
      return jsonResponse({ status: "pending", reason: "currency_mismatch" }, 202, origin);
    }
    let providerAmount: number;
    try { providerAmount = kwdDecimalToFils(ex.amountRaw ?? ""); }
    catch { return jsonResponse({ status: "pending", reason: "amount_unparseable" }, 202, origin); }
    if (providerAmount !== amountFils) {
      return jsonResponse({ status: "pending", reason: "amount_mismatch" }, 202, origin);
    }
    const { error: sErr } = await svc.rpc("v2_settle_verified_upayments_payment", {
      p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: attemptId,
      p_merchant_reference: merchantRef,
      p_track_id: trackId, p_session_id: sessionId,
      p_provider_order_id: effectiveProviderOrderId,
      p_amount_fils: amountFils, p_currency: "KWD",
      p_result: verdict.normalized, p_external_event_id: evtId,
      p_sanitized_verified_payload: sanitized,
    });
    if (sErr) return jsonResponse({ error: safeRpcError(sErr) }, 500, origin);
    return jsonResponse({ status: "paid", order_id: orderId }, 200, origin);
  }

  if (verdict.verdict === "failed" || verdict.verdict === "cancelled") {
    const { error: fErr } = await svc.rpc("v2_mark_verified_payment_failure", {
      p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: attemptId,
      p_merchant_reference: merchantRef, p_result: verdict.normalized,
      p_external_event_id: evtId, p_sanitized_payload: sanitized,
    });
    if (fErr) return jsonResponse({ error: safeRpcError(fErr) }, 500, origin);
    return jsonResponse({ status: verdict.verdict, order_id: orderId }, 200, origin);
  }

  // pending / unknown: never mutate money state.
  return jsonResponse({ status: "pending", reason: verdict.verdict }, 202, origin);
});
