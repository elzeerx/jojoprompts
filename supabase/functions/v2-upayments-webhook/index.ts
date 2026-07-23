// v2-upayments-webhook (PUBLIC, verify_jwt=false)
// Provider hint only. We ignore any status/amount from the payload and
// re-verify via GET /get-payment-status. Actor comes from the resolved
// local attempt's owner; nothing about the sender is trusted.

import {
  jsonResponse, methodGuard, readBoundedJson, serviceClient,
  loadUpaymentsConfig, providerFetch, extractStatusFields,
  normalizeStatusResult, kwdDecimalToFils, sanitizeProviderPayload,
  eventIdForStatus,
} from "../_shared/v2Upayments.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const g = methodGuard(req, "POST");
  if (g) return g;

  const parsed = await readBoundedJson<Record<string, unknown>>(req);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, origin);

  // Hints only — never trusted for state.
  const ex = extractStatusFields(parsed.body);
  if (!ex.trackId && !ex.sessionId && !ex.providerOrderId && !ex.merchantReference) {
    return jsonResponse({ error: "unresolvable" }, 400, origin);
  }

  const svc = serviceClient();

  // Resolve exactly one local attempt.
  let query = svc.from("payment_attempts")
    .select("id, order_id, provider")
    .eq("provider", "upayments")
    .limit(2);
  if (ex.trackId) query = query.eq("track_id", ex.trackId);
  else if (ex.sessionId) query = query.eq("session_id", ex.sessionId);
  else if (ex.providerOrderId) query = query.eq("provider_order_id", ex.providerOrderId);
  else if (ex.merchantReference) query = query.eq("merchant_reference", ex.merchantReference);

  const { data: rows, error: qErr } = await query;
  if (qErr) return jsonResponse({ error: qErr.message }, 500, origin);
  if (!rows || rows.length !== 1) {
    return jsonResponse({ error: "unresolvable" }, 400, origin);
  }
  const attempt = rows[0];

  const { data: order, error: oErr } = await svc.from("orders")
    .select("id, user_id").eq("id", attempt.order_id).maybeSingle();
  if (oErr || !order) return jsonResponse({ error: "no_order" }, 400, origin);
  const actorUserId = order.user_id as string;

  const { data: claim, error: clErr } = await svc.rpc("v2_claim_payment_status_check", {
    p_actor_user_id: actorUserId, p_order_id: order.id, p_attempt_id: attempt.id,
    p_allow_admin: false,
  });
  if (clErr) return jsonResponse({ error: clErr.message }, 400, origin);
  const cl = (claim ?? {}) as Record<string, unknown>;
  if (cl.ok === false && cl.error === "backoff_active") {
    return jsonResponse({ status: "pending", reason: "backoff_active" }, 202, origin);
  }
  if (cl.claimed !== true) return jsonResponse({ status: "pending" }, 202, origin);

  const cfg = loadUpaymentsConfig();
  if (!cfg) return jsonResponse({ status: "pending", reason: "provider_disabled" }, 202, origin);

  const trackId = cl.track_id ? String(cl.track_id) : null;
  const sessionId = cl.session_id ? String(cl.session_id) : null;
  const providerOrderId = cl.provider_order_id ? String(cl.provider_order_id) : null;
  const merchantRef = String(cl.merchant_reference);
  const amountFils = Number(cl.amount_fils);
  const attemptId = String(cl.attempt_id);
  const orderId = String(cl.order_id);

  const path = trackId
    ? `/get-payment-status/${encodeURIComponent(trackId)}`
    : `/get-payment-status/?session_id=${encodeURIComponent(sessionId ?? "")}`;
  const res = await providerFetch(cfg, path, { method: "GET" });
  if (res.kind !== "ok") return jsonResponse({ status: "pending", reason: res.kind }, 202, origin);

  const sx = extractStatusFields(res.json);
  const verdict = normalizeStatusResult(sx.result);

  if (sx.merchantReference && sx.merchantReference !== merchantRef) {
    return jsonResponse({ status: "pending", reason: "identifier_mismatch" }, 202, origin);
  }
  if (sx.trackId && trackId && sx.trackId !== trackId) {
    return jsonResponse({ status: "pending", reason: "track_id_mismatch" }, 202, origin);
  }
  if (sx.sessionId && sessionId && sx.sessionId !== sessionId) {
    return jsonResponse({ status: "pending", reason: "session_id_mismatch" }, 202, origin);
  }
  if (sx.providerOrderId && providerOrderId && sx.providerOrderId !== providerOrderId) {
    return jsonResponse({ status: "pending", reason: "provider_order_id_mismatch" }, 202, origin);
  }

  const sanitized = sanitizeProviderPayload("payment_status_webhook", res.json, res.status);
  const evtId = eventIdForStatus(orderId, sx.providerOrderId ?? providerOrderId ?? sx.trackId ?? trackId, verdict.verdict);

  if (verdict.verdict === "captured") {
    if (!sx.currency || sx.currency.toUpperCase() !== "KWD") {
      return jsonResponse({ status: "pending", reason: "currency_mismatch" }, 202, origin);
    }
    let providerAmount: number;
    try { providerAmount = kwdDecimalToFils(sx.amountRaw ?? ""); }
    catch { return jsonResponse({ status: "pending", reason: "amount_unparseable" }, 202, origin); }
    if (providerAmount !== amountFils) {
      return jsonResponse({ status: "pending", reason: "amount_mismatch" }, 202, origin);
    }
    const { error: sErr } = await svc.rpc("v2_settle_verified_upayments_payment", {
      p_actor_user_id: actorUserId, p_order_id: orderId, p_attempt_id: attemptId,
      p_merchant_reference: merchantRef,
      p_track_id: trackId, p_session_id: sessionId, p_provider_order_id: providerOrderId,
      p_amount_fils: amountFils, p_currency: "KWD",
      p_result: verdict.normalized, p_external_event_id: evtId,
      p_sanitized_verified_payload: sanitized,
    });
    if (sErr) return jsonResponse({ error: sErr.message }, 500, origin);
    return jsonResponse({ status: "paid" }, 200, origin);
  }

  if (verdict.verdict === "failed" || verdict.verdict === "cancelled") {
    const { error: fErr } = await svc.rpc("v2_mark_verified_payment_failure", {
      p_actor_user_id: actorUserId, p_order_id: orderId, p_attempt_id: attemptId,
      p_merchant_reference: merchantRef, p_result: verdict.normalized,
      p_external_event_id: evtId, p_sanitized_payload: sanitized,
    });
    if (fErr) return jsonResponse({ error: fErr.message }, 500, origin);
    return jsonResponse({ status: verdict.verdict }, 200, origin);
  }

  return jsonResponse({ status: "pending", reason: verdict.verdict }, 202, origin);
});
