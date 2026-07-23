// v2-upayments-webhook (PUBLIC, verify_jwt=false)
// Provider hint only. We ignore any status/amount from the payload and
// re-verify via GET /get-payment-status. Actor comes from the resolved
// local attempt's owner; nothing about the sender is trusted.
//
// Order:
//   1) parse capped body (no auth, no DB)
//   2) strict envelope validation (unknown keys, plain data, ≥1 hint) — no DB
//   3) feature-flag gate → if disabled, return pending/provider_disabled (no DB)
//   4) resolve local attempt from hinted identifiers
//   5) claim → GET status → verify → settle/fail / record sanitized rejection

import {
  jsonResponse, methodGuard, readBoundedJson, serviceClient,
  loadUpaymentsConfig, providerFetch, providerSuccessFlag,
  extractStatusFields, normalizePaymentStatus, kwdDecimalToFils,
  sanitizeProviderPayload, eventIdForStatus, safeRpcError,
  validateWebhookEnvelope,
} from "../_shared/v2Upayments.ts";

type RejectionReason =
  | "missing_merchant_reference" | "merchant_reference_mismatch"
  | "track_id_mismatch" | "session_id_mismatch" | "provider_order_id_mismatch"
  | "currency_missing" | "currency_mismatch"
  | "amount_missing" | "amount_unparseable" | "amount_mismatch";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const g = methodGuard(req, "POST");
  if (g) return g;

  // 1. Parse capped JSON. No auth. No DB touched yet.
  const parsed = await readBoundedJson<Record<string, unknown>>(req);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, origin);

  // 2. Strict envelope validation BEFORE any DB access or feature gate.
  const env = validateWebhookEnvelope(parsed.body);
  if (!env.ok) return jsonResponse({ error: env.error }, 400, origin);

  // 3. Feature-flag gate BEFORE any DB lookup/claim/update.
  const cfg = loadUpaymentsConfig();
  if (!cfg) {
    return jsonResponse({ status: "pending", reason: "provider_disabled" }, 202, origin);
  }

  const ex = extractStatusFields(parsed.body);

  const svc = serviceClient();

  let query = svc.from("payment_attempts")
    .select("id, order_id, provider")
    .eq("provider", "upayments")
    .limit(2);
  if (ex.trackId) query = query.eq("track_id", ex.trackId);
  else if (ex.sessionId) query = query.eq("session_id", ex.sessionId);
  else if (ex.providerOrderId) query = query.eq("provider_order_id", ex.providerOrderId);
  else if (ex.merchantReference) query = query.eq("merchant_reference", ex.merchantReference);

  const { data: rows, error: qErr } = await query;
  if (qErr) return jsonResponse({ error: "server_error" }, 500, origin);
  if (!rows || rows.length !== 1) {
    return jsonResponse({ error: "unresolvable" }, 400, origin);
  }
  const attempt = rows[0];

  const { data: order, error: oErr } = await svc.from("orders")
    .select("id, user_id").eq("id", attempt.order_id).maybeSingle();
  if (oErr || !order) return jsonResponse({ error: "no_order" }, 400, origin);
  const actorUserId = order.user_id as string;

  // 4. Claim.
  const { data: claim, error: clErr } = await svc.rpc("v2_claim_payment_status_check", {
    p_actor_user_id: actorUserId, p_order_id: order.id, p_attempt_id: attempt.id,
    p_allow_admin: false,
  });
  if (clErr) return jsonResponse({ error: safeRpcError(clErr) }, 400, origin);
  const cl = (claim ?? {}) as Record<string, unknown>;
  if (cl.ok === false && cl.error === "backoff_active") {
    return jsonResponse({ status: "pending", reason: "backoff_active" }, 202, origin);
  }
  if (cl.ok === false && cl.error === "global_backoff") {
    return jsonResponse({ status: "pending", reason: "global_backoff" }, 202, origin);
  }
  if (cl.claimed !== true) return jsonResponse({ status: "pending" }, 202, origin);

  const trackId = cl.track_id ? String(cl.track_id) : null;
  const sessionId = cl.session_id ? String(cl.session_id) : null;
  const providerOrderId = cl.provider_order_id ? String(cl.provider_order_id) : null;
  const merchantRef = String(cl.merchant_reference);
  const amountFils = Number(cl.amount_fils);
  const attemptId = String(cl.attempt_id);
  const orderId = String(cl.order_id);

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

  const sx = extractStatusFields(res.json);
  const verdict = normalizePaymentStatus(sx.result);
  const sanitized = sanitizeProviderPayload("payment_status_webhook", res.json, res.status);
  const providerIdForEvt = providerOrderId ?? sx.providerOrderId ?? sx.trackId ?? trackId;
  const rejectEvt = (reason: RejectionReason) =>
    eventIdForStatus(orderId, providerIdForEvt, `reject:${reason}`);

  const rejectResponse = async (reason: RejectionReason) => {
    const { error } = await svc.rpc("v2_record_upayments_verification_rejection", {
      p_actor_user_id: actorUserId,
      p_order_id: orderId,
      p_attempt_id: attemptId,
      p_external_event_id: rejectEvt(reason),
      p_reason: reason,
      p_sanitized_payload: sanitized,
    });
    if (error) return jsonResponse({ error: "recovery_required" }, 500, origin);
    return jsonResponse({ status: "pending", reason }, 202, origin);
  };

  if (!sx.merchantReference) return await rejectResponse("missing_merchant_reference");
  if (sx.merchantReference !== merchantRef) return await rejectResponse("merchant_reference_mismatch");
  if (trackId) {
    if (!sx.trackId || sx.trackId !== trackId) return await rejectResponse("track_id_mismatch");
  } else if (sessionId) {
    if (!sx.sessionId || sx.sessionId !== sessionId) return await rejectResponse("session_id_mismatch");
  }
  if (providerOrderId && sx.providerOrderId && sx.providerOrderId !== providerOrderId) {
    return await rejectResponse("provider_order_id_mismatch");
  }
  const effectiveProviderOrderId = providerOrderId ?? sx.providerOrderId ?? null;

  const evtId = eventIdForStatus(orderId,
    effectiveProviderOrderId ?? sx.trackId ?? trackId, verdict.verdict);

  if (verdict.verdict === "captured") {
    if (!sx.currency) return await rejectResponse("currency_missing");
    if (sx.currency.toUpperCase() !== "KWD") return await rejectResponse("currency_mismatch");
    if (!sx.amountRaw) return await rejectResponse("amount_missing");
    let providerAmount: number;
    try { providerAmount = kwdDecimalToFils(sx.amountRaw); }
    catch { return await rejectResponse("amount_unparseable"); }
    if (providerAmount !== amountFils) return await rejectResponse("amount_mismatch");

    const { error: sErr } = await svc.rpc("v2_settle_verified_upayments_payment", {
      p_actor_user_id: actorUserId, p_order_id: orderId, p_attempt_id: attemptId,
      p_merchant_reference: merchantRef,
      p_track_id: trackId, p_session_id: sessionId,
      p_provider_order_id: effectiveProviderOrderId,
      p_amount_fils: amountFils, p_currency: "KWD",
      p_result: verdict.normalized, p_external_event_id: evtId,
      p_sanitized_verified_payload: sanitized,
    });
    if (sErr) return jsonResponse({ error: safeRpcError(sErr) }, 500, origin);
    return jsonResponse({ status: "paid" }, 200, origin);
  }

  if (verdict.verdict === "failed" || verdict.verdict === "cancelled") {
    const { error: fErr } = await svc.rpc("v2_mark_verified_payment_failure", {
      p_actor_user_id: actorUserId, p_order_id: orderId, p_attempt_id: attemptId,
      p_merchant_reference: merchantRef, p_result: verdict.normalized,
      p_external_event_id: evtId, p_sanitized_payload: sanitized,
    });
    if (fErr) return jsonResponse({ error: safeRpcError(fErr) }, 500, origin);
    return jsonResponse({ status: verdict.verdict }, 200, origin);
  }

  return jsonResponse({ status: "pending", reason: verdict.verdict }, 202, origin);
});
