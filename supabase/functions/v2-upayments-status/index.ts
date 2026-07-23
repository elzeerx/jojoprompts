// v2-upayments-status
// POST { order_id } — owner-only.
// Claims a status check with exponential backoff, calls GET /get-payment-status/{track_id}
// (or ?session_id=), verifies all identifiers/amount/currency locally, and only then
// invokes v2_settle_verified_upayments_payment or v2_mark_verified_payment_failure.
// Never trusts redirect/query strings.

import {
  jsonResponse, methodGuard, readBoundedJson, requireUser,
  serviceClient, loadUpaymentsConfig, providerFetch,
  extractStatusFields, normalizeStatusResult, kwdDecimalToFils,
  sanitizeProviderPayload, eventIdForStatus,
} from "../_shared/v2Upayments.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const g = methodGuard(req, "POST");
  if (g) return g;

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const parsed = await readBoundedJson<{ order_id?: string }>(req);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, origin);
  const orderId = parsed.body?.order_id ?? "";
  if (typeof orderId !== "string" || !UUID_RE.test(orderId)) {
    return jsonResponse({ error: "invalid_body" }, 400, origin);
  }

  const svc = serviceClient();

  // Look up the most recent upayments attempt for this order.
  const { data: att, error: aErr } = await svc
    .from("payment_attempts")
    .select("id")
    .eq("order_id", orderId)
    .eq("provider", "upayments")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aErr) return jsonResponse({ error: aErr.message }, 500, origin);
  if (!att) return jsonResponse({ error: "no_attempt" }, 404, origin);

  const { data: claim, error: clErr } = await svc.rpc("v2_claim_payment_status_check", {
    p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: att.id,
    p_allow_admin: false,
  });
  if (clErr) return jsonResponse({ error: clErr.message }, 400, origin);
  const cl = (claim ?? {}) as Record<string, unknown>;
  if (cl.ok === false && cl.error === "backoff_active") {
    return jsonResponse({ status: "pending", reason: "backoff_active",
      next_check_after: cl.next_check_after }, 202, origin);
  }
  if (cl.claimed !== true) return jsonResponse({ error: "claim_failed" }, 409, origin);

  const cfg = loadUpaymentsConfig();
  if (!cfg) return jsonResponse({ status: "pending", reason: "provider_disabled" }, 202, origin);

  const trackId = cl.track_id ? String(cl.track_id) : null;
  const sessionId = cl.session_id ? String(cl.session_id) : null;
  const providerOrderId = cl.provider_order_id ? String(cl.provider_order_id) : null;
  const merchantRef = String(cl.merchant_reference);
  const amountFils = Number(cl.amount_fils);
  const attemptId = String(cl.attempt_id);

  const path = trackId
    ? `/get-payment-status/${encodeURIComponent(trackId)}`
    : `/get-payment-status/?session_id=${encodeURIComponent(sessionId ?? "")}`;

  const res = await providerFetch(cfg, path, { method: "GET" });
  if (res.kind !== "ok") {
    return jsonResponse({ status: "pending", reason: res.kind }, 202, origin);
  }

  const ex = extractStatusFields(res.json);
  const verdict = normalizeStatusResult(ex.result);

  // Verify identifiers before touching money.
  if (ex.merchantReference && ex.merchantReference !== merchantRef) {
    return jsonResponse({ status: "pending", reason: "identifier_mismatch" }, 202, origin);
  }
  if (ex.trackId && trackId && ex.trackId !== trackId) {
    return jsonResponse({ status: "pending", reason: "track_id_mismatch" }, 202, origin);
  }
  if (ex.sessionId && sessionId && ex.sessionId !== sessionId) {
    return jsonResponse({ status: "pending", reason: "session_id_mismatch" }, 202, origin);
  }
  if (ex.providerOrderId && providerOrderId && ex.providerOrderId !== providerOrderId) {
    return jsonResponse({ status: "pending", reason: "provider_order_id_mismatch" }, 202, origin);
  }

  const sanitized = sanitizeProviderPayload("payment_status", res.json, res.status);
  const evtId = eventIdForStatus(orderId, ex.providerOrderId ?? providerOrderId ?? ex.trackId ?? trackId, verdict.verdict);

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
      p_track_id: trackId, p_session_id: sessionId, p_provider_order_id: providerOrderId,
      p_amount_fils: amountFils, p_currency: "KWD",
      p_result: verdict.normalized, p_external_event_id: evtId,
      p_sanitized_verified_payload: sanitized,
    });
    if (sErr) return jsonResponse({ error: sErr.message }, 500, origin);
    return jsonResponse({ status: "paid", order_id: orderId }, 200, origin);
  }

  if (verdict.verdict === "failed" || verdict.verdict === "cancelled") {
    const { error: fErr } = await svc.rpc("v2_mark_verified_payment_failure", {
      p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: attemptId,
      p_merchant_reference: merchantRef, p_result: verdict.normalized,
      p_external_event_id: evtId, p_sanitized_payload: sanitized,
    });
    if (fErr) return jsonResponse({ error: fErr.message }, 500, origin);
    return jsonResponse({ status: verdict.verdict, order_id: orderId }, 200, origin);
  }

  return jsonResponse({ status: "pending", reason: verdict.verdict }, 202, origin);
});
