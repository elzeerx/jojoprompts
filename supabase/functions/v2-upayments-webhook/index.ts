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
  validateWebhookEnvelope, webhookLookupPriority, webhookIdentifierColumn,
} from "../_shared/v2Upayments.ts";
import { scheduleReceiptDelivery } from "../_shared/v2ReceiptDelivery.ts";

type RejectionReason =
  | "missing_merchant_reference" | "merchant_reference_mismatch"
  | "track_id_mismatch" | "track_id_missing" | "provider_order_id_mismatch"
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

  // 4. Resolve local attempt by trying identifiers in a bounded priority
  //    order. Zero-row lookups are skipped; the first exactly-one match wins.
  //    A fresh provider track_id may not exist locally yet on the initial
  //    callback, so we MUST fall through to merchant_reference (server-
  //    originated). Any ambiguity (>=2 rows) is a hard unresolvable.
  const lookups = webhookLookupPriority({
    trackId: ex.trackId, sessionId: ex.sessionId,
    providerOrderId: ex.providerOrderId, merchantReference: ex.merchantReference,
  });
  let attempt: { id: string; order_id: string } | null = null;
  for (const ident of lookups) {
    const col = webhookIdentifierColumn(ident.kind);
    const { data: rows, error: qErr } = await svc.from("payment_attempts")
      .select("id, order_id, provider")
      .eq("provider", "upayments")
      .eq(col, ident.value)
      .limit(2);
    if (qErr) return jsonResponse({ error: "server_error" }, 500, origin);
    if (!rows || rows.length === 0) continue;
    if (rows.length > 1) return jsonResponse({ error: "unresolvable" }, 400, origin);
    attempt = { id: rows[0].id as string, order_id: rows[0].order_id as string };
    break;
  }
  if (!attempt) return jsonResponse({ error: "unresolvable" }, 400, origin);

  const { data: order, error: oErr } = await svc.from("orders")
    .select("id, user_id").eq("id", attempt.order_id).maybeSingle();
  if (oErr || !order) return jsonResponse({ error: "no_order" }, 400, origin);
  const actorUserId = order.user_id as string;

  // 5. Claim.
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

  const storedTrackId = cl.track_id ? String(cl.track_id) : null;
  const storedHostedSessionId = cl.session_id ? String(cl.session_id) : null;
  const storedProviderOrderId = cl.provider_order_id ? String(cl.provider_order_id) : null;
  const merchantRef = String(cl.merchant_reference);
  const amountFils = Number(cl.amount_fils);
  const attemptId = String(cl.attempt_id);
  const orderId = String(cl.order_id);

  // Verification query: prefer stored track_id, else stored hosted session.
  const path = storedTrackId
    ? `/get-payment-status/${encodeURIComponent(storedTrackId)}`
    : `/get-payment-status?session_id=${encodeURIComponent(storedHostedSessionId ?? "")}`;
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
  const providerIdForEvt = storedProviderOrderId ?? sx.providerOrderId ?? sx.trackId ?? storedTrackId;
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

  // Merchant reference is the server-originated anchor — MUST match.
  if (!sx.merchantReference) return await rejectResponse("missing_merchant_reference");
  if (sx.merchantReference !== merchantRef) return await rejectResponse("merchant_reference_mismatch");

  if (storedTrackId) {
    // Track-id-originated query: provider MUST echo the same track_id.
    if (!sx.trackId || sx.trackId !== storedTrackId) {
      return await rejectResponse("track_id_mismatch");
    }
  }
  // NOTE: When we queried by stored hosted session, DO NOT compare
  // sx.sessionId (a per-transaction UUID from data.transaction.session_id)
  // to storedHostedSessionId (the long hosted-checkout id). They are
  // semantically different UPayments identifiers. Security is enforced via
  // stored hosted session + merchant reference + amount + currency + captured.

  if (storedProviderOrderId && sx.providerOrderId && sx.providerOrderId !== storedProviderOrderId) {
    return await rejectResponse("provider_order_id_mismatch");
  }

  // Effective identifiers to persist.
  const effectiveTrackId = storedTrackId ?? sx.trackId ?? null;
  const effectiveProviderOrderId = storedProviderOrderId ?? sx.providerOrderId ?? null;

  const evtId = eventIdForStatus(orderId,
    effectiveProviderOrderId ?? effectiveTrackId, verdict.verdict);

  if (verdict.verdict === "captured") {
    if (!sx.currency) return await rejectResponse("currency_missing");
    if (sx.currency.toUpperCase() !== "KWD") return await rejectResponse("currency_mismatch");
    if (!sx.amountRaw) return await rejectResponse("amount_missing");
    let providerAmount: number;
    try { providerAmount = kwdDecimalToFils(sx.amountRaw); }
    catch { return await rejectResponse("amount_unparseable"); }
    if (providerAmount !== amountFils) return await rejectResponse("amount_mismatch");
    // When settling a session-originated status response, a nonempty provider
    // track_id is REQUIRED so we can persist a canonical settlement identifier.
    if (!effectiveTrackId) return await rejectResponse("track_id_missing");

    const { error: sErr } = await svc.rpc("v2_settle_verified_upayments_payment", {
      p_actor_user_id: actorUserId, p_order_id: orderId, p_attempt_id: attemptId,
      p_merchant_reference: merchantRef,
      p_track_id: effectiveTrackId,
      // Preserve the original stored hosted-checkout session id.
      p_session_id: storedHostedSessionId,
      p_provider_order_id: effectiveProviderOrderId,
      p_amount_fils: amountFils, p_currency: "KWD",
      p_result: verdict.normalized, p_external_event_id: evtId,
      p_sanitized_verified_payload: sanitized,
    });
    // Replay of a fully-settled attempt is safe: the RPC is idempotent via
    // external_event_id, and same-shape rejection reasons produce stable ids.
    if (sErr) return jsonResponse({ error: safeRpcError(sErr) }, 500, origin);
    // Best-effort receipt scheduling — never blocks or rolls back settlement.
    try { scheduleReceiptDelivery(svc, orderId); } catch (_) { /* swallow */ }
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
