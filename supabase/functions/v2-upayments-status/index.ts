// v2-upayments-status
// POST { order_id } — owner-only.
//
// Order:
//   1) validate body + auth
//   2) load config → if disabled, return pending/provider_disabled with ZERO DB action
//   3) ownership-first attempt resolution via SECURITY DEFINER RPC
//   4) v2_claim_payment_status_check → GET provider status
//   5) verify official status===true, merchant reference, lookup identifier,
//      amount/currency BEFORE settle/fail. Terminal-correlation rejections are
//      audit-recorded as a sanitized rejection event; no money state changes.

import {
  jsonResponse, methodGuard, readBoundedJson, hasOnlyAllowedKeys, requireUser,
  serviceClient, loadUpaymentsConfig, providerFetch, providerSuccessFlag,
  extractStatusFields, normalizePaymentStatus, kwdDecimalToFils,
  sanitizeProviderPayload, eventIdForStatus, safeRpcError,
} from "../_shared/v2Upayments.ts";
import { scheduleReceiptDelivery } from "../_shared/v2ReceiptDelivery.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validBody(b: unknown): b is { order_id: string } {
  if (!b || typeof b !== "object" || Array.isArray(b)) return false;
  const o = b as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(o, ["order_id"])) return false;
  return typeof o.order_id === "string" && UUID_RE.test(o.order_id);
}

type RejectionReason =
  | "missing_merchant_reference" | "merchant_reference_mismatch"
  | "track_id_mismatch" | "track_id_missing" | "provider_order_id_mismatch"
  | "currency_missing" | "currency_mismatch"
  | "amount_missing" | "amount_unparseable" | "amount_mismatch";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const g = methodGuard(req, "POST");
  if (g) return g;

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const parsed = await readBoundedJson(req);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, origin);
  if (!validBody(parsed.body)) return jsonResponse({ error: "invalid_body" }, 400, origin);
  const orderId = parsed.body.order_id;

  const cfg = loadUpaymentsConfig();
  if (!cfg) {
    return jsonResponse({ status: "pending", reason: "provider_disabled" }, 202, origin);
  }

  const svc = serviceClient();

  // Ownership-first attempt lookup (no direct table read).
  const { data: resolve, error: rErr } = await svc.rpc(
    "v2_resolve_owned_latest_upayments_attempt",
    { p_actor_user_id: auth.userId, p_order_id: orderId, p_allow_admin: false },
  );
  if (rErr) return jsonResponse({ error: "server_error" }, 500, origin);
  const rs = (resolve ?? {}) as Record<string, unknown>;
  if (rs.ok !== true) {
    const err = String(rs.error ?? "not_found");
    return jsonResponse({ error: err === "no_attempt" ? "no_attempt" : "not_found" },
      404, origin);
  }
  const attemptId = String(rs.attempt_id);

  const { data: claim, error: clErr } = await svc.rpc("v2_claim_payment_status_check", {
    p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: attemptId,
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

  const storedTrackId = cl.track_id ? String(cl.track_id) : null;
  const storedHostedSessionId = cl.session_id ? String(cl.session_id) : null;
  const storedProviderOrderId = cl.provider_order_id ? String(cl.provider_order_id) : null;
  const merchantRef = String(cl.merchant_reference);
  const amountFils = Number(cl.amount_fils);
  const settledAttemptId = String(cl.attempt_id);

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

  const ex = extractStatusFields(res.json);
  const verdict = normalizePaymentStatus(ex.result);
  const sanitized = sanitizeProviderPayload("payment_status", res.json, res.status);
  const providerIdForEvt = storedProviderOrderId ?? ex.providerOrderId ?? ex.trackId ?? storedTrackId;
  const rejectEvt = (reason: RejectionReason) =>
    eventIdForStatus(orderId, providerIdForEvt, `reject:${reason}`);

  const recordRejection = async (reason: RejectionReason) => {
    const { error } = await svc.rpc("v2_record_upayments_verification_rejection", {
      p_actor_user_id: auth.userId,
      p_order_id: orderId,
      p_attempt_id: settledAttemptId,
      p_external_event_id: rejectEvt(reason),
      p_reason: reason,
      p_sanitized_payload: sanitized,
    });
    return error;
  };
  const rejectResponse = async (reason: RejectionReason) => {
    const err = await recordRejection(reason);
    if (err) return jsonResponse({ error: "recovery_required" }, 500, origin);
    return jsonResponse({ status: "pending", reason }, 202, origin);
  };

  // Merchant reference is the server-originated anchor — MUST match.
  if (!ex.merchantReference) return await rejectResponse("missing_merchant_reference");
  if (ex.merchantReference !== merchantRef) {
    return await rejectResponse("merchant_reference_mismatch");
  }
  if (storedTrackId) {
    if (!ex.trackId || ex.trackId !== storedTrackId) {
      return await rejectResponse("track_id_mismatch");
    }
  }
  // When queried by stored hosted session, DO NOT compare ex.sessionId to
  // storedHostedSessionId: UPayments returns a per-transaction UUID at
  // data.transaction.session_id which differs from the hosted-checkout id.
  if (storedProviderOrderId && ex.providerOrderId && ex.providerOrderId !== storedProviderOrderId) {
    return await rejectResponse("provider_order_id_mismatch");
  }
  const effectiveTrackId = storedTrackId ?? ex.trackId ?? null;
  const effectiveProviderOrderId = storedProviderOrderId ?? ex.providerOrderId ?? null;

  const evtId = eventIdForStatus(orderId,
    effectiveProviderOrderId ?? effectiveTrackId, verdict.verdict);

  if (verdict.verdict === "captured") {
    if (!ex.currency) return await rejectResponse("currency_missing");
    if (ex.currency.toUpperCase() !== "KWD") return await rejectResponse("currency_mismatch");
    if (!ex.amountRaw) return await rejectResponse("amount_missing");
    let providerAmount: number;
    try { providerAmount = kwdDecimalToFils(ex.amountRaw); }
    catch { return await rejectResponse("amount_unparseable"); }
    if (providerAmount !== amountFils) return await rejectResponse("amount_mismatch");
    if (!effectiveTrackId) return await rejectResponse("track_id_missing");

    const { error: sErr } = await svc.rpc("v2_settle_verified_upayments_payment", {
      p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: settledAttemptId,
      p_merchant_reference: merchantRef,
      p_track_id: effectiveTrackId,
      p_session_id: storedHostedSessionId,
      p_provider_order_id: effectiveProviderOrderId,
      p_amount_fils: amountFils, p_currency: "KWD",
      p_result: verdict.normalized, p_external_event_id: evtId,
      p_sanitized_verified_payload: sanitized,
    });
    if (sErr) return jsonResponse({ error: safeRpcError(sErr) }, 500, origin);

    let productIds: string[] = [];
    try {
      const { data: items } = await svc
        .from("order_items")
        .select("product_id")
        .eq("order_id", orderId);
      productIds = (items ?? [])
        .map((row: { product_id: string | null }) => row.product_id)
        .filter((v: string | null): v is string => typeof v === "string");
    } catch (_) {
      productIds = [];
    }
    return jsonResponse(
      { status: "paid", order_id: orderId, product_ids: productIds },
      200,
      origin,
    );
  }



  if (verdict.verdict === "failed" || verdict.verdict === "cancelled") {
    const { error: fErr } = await svc.rpc("v2_mark_verified_payment_failure", {
      p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: settledAttemptId,
      p_merchant_reference: merchantRef, p_result: verdict.normalized,
      p_external_event_id: evtId, p_sanitized_payload: sanitized,
    });
    if (fErr) return jsonResponse({ error: safeRpcError(fErr) }, 500, origin);
    return jsonResponse({ status: verdict.verdict, order_id: orderId }, 200, origin);
  }

  // pending / unknown: never mutate money state, never audit-record.
  return jsonResponse({ status: "pending", reason: verdict.verdict }, 202, origin);
});
