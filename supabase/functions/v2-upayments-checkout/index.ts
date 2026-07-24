// v2-upayments-checkout
// POST { product_ids, idempotency_key, discount_code?, language? }
//
// Order of operations:
//   1) validate body + auth
//   2) load config → if disabled: return provider_disabled with ZERO DB mutation
//   3) v2_create_checkout_order → v2_claim_charge_submission → POST /charge
//   4) require official response.status === true, valid HTTPS provider url,
//      and provider track/session identifier before recording submitted charge.

import {
  jsonResponse, methodGuard, readBoundedJson, hasOnlyAllowedKeys,
  requireUser, serviceClient, loadUpaymentsConfig,
  loadCustomerFields, providerFetch, providerSuccessFlag,
  extractChargeFields, isValidUpaymentsRedirectUrl,
  filsToKwdDecimal, sanitizeProviderPayload, eventIdForCharge,
  safeRpcError,
} from "../_shared/v2Upayments.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_URL") ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = ["product_ids","idempotency_key","discount_code","language"] as const;

type Body = {
  product_ids: string[];
  idempotency_key: string;
  discount_code?: string;
  language?: "en" | "ar";
};

function validBody(b: unknown): b is Body {
  if (!b || typeof b !== "object" || Array.isArray(b)) return false;
  const o = b as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(o, ALLOWED_KEYS as unknown as string[])) return false;
  if (!Array.isArray(o.product_ids)) return false;
  if (o.product_ids.length < 1 || o.product_ids.length > 50) return false;
  if (!o.product_ids.every((x) => typeof x === "string" && UUID_RE.test(x))) return false;
  if (typeof o.idempotency_key !== "string"
      || o.idempotency_key.length < 1 || o.idempotency_key.length > 120) return false;
  if (o.discount_code != null
      && (typeof o.discount_code !== "string" || o.discount_code.length > 64)) return false;
  if (o.language != null && o.language !== "en" && o.language !== "ar") return false;
  return true;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const guard = methodGuard(req, "POST");
  if (guard) return guard;

  // 1. Auth + body validation (no DB mutations here).
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const parsed = await readBoundedJson(req);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, parsed.status, origin);
  if (!validBody(parsed.body)) return jsonResponse({ error: "invalid_body" }, 400, origin);
  const body = parsed.body;

  // 2. Feature-flag gate BEFORE any mutation.
  const cfg = loadUpaymentsConfig();
  if (!cfg) return jsonResponse({ error: "provider_disabled" }, 503, origin);

  const svc = serviceClient();

  // 3. Create/replay order.
  const { data: create, error: cErr } = await svc.rpc("v2_create_checkout_order", {
    p_actor_user_id: auth.userId,
    p_product_ids: body.product_ids,
    p_idempotency_key: body.idempotency_key,
    p_discount_code: body.discount_code ?? null,
  });
  if (cErr) return jsonResponse({ error: safeRpcError(cErr) }, 400, origin);
  if (!create || typeof create !== "object") {
    return jsonResponse({ error: "server_error" }, 500, origin);
  }
  const cr = create as Record<string, unknown>;
  if (cr.ok === false) return jsonResponse(cr, 409, origin);

  if (cr.settled_internally === true) {
    return jsonResponse({
      ok: true, settled_internally: true,
      order_id: cr.order_id, order_number: cr.order_number,
      total_fils: cr.total_fils, currency: cr.currency,
    }, 200, origin);
  }

  const orderId = String(cr.order_id);
  const attemptId = String(cr.attempt_id);

  // 4. Claim before POST /charge.
  const { data: claim, error: clErr } = await svc.rpc("v2_claim_charge_submission", {
    p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: attemptId,
  });
  if (clErr) return jsonResponse({ error: safeRpcError(clErr) }, 400, origin);
  const cl = (claim ?? {}) as Record<string, unknown>;

  if (cl.ok === true && cl.claimed === false && cl.replay === true) {
    const url = String(cl.checkout_url ?? "");
    if (!isValidUpaymentsRedirectUrl(url)) {
      return jsonResponse({ error: "invalid_stored_url" }, 502, origin);
    }
    return jsonResponse({ ok: true, order_id: orderId, checkout_url: url, replay: true },
      200, origin);
  }
  if (cl.ok === false && cl.error === "recovery_required") {
    return jsonResponse({ error: "recovery_required", order_id: orderId }, 409, origin);
  }
  if (cl.claimed !== true) return jsonResponse({ error: "claim_failed" }, 409, origin);

  // 5. Build charge body from verified server-side identity + config.
  const amountDecimal = filsToKwdDecimal(Number(cl.amount_fils));
  const merchantRef = String(cl.merchant_reference);
  // Clean, query-free callback bases — UPayments appends its own query
  // starting with `?` and would otherwise produce a malformed double-`?`
  // URL when we included our own query parameter. Path parameter wins in
  // the frontend router; provider-appended params cannot override it.
  const encodedOrderId = encodeURIComponent(orderId);
  const returnUrl = `${cfg.siteUrl}/checkout/return/${encodedOrderId}`;
  const cancelUrl = `${cfg.siteUrl}/checkout/cancel/${encodedOrderId}`;
  const notificationUrl = `${PROJECT_URL}/functions/v1/v2-upayments-webhook`;

  const customerFields = await loadCustomerFields(svc, auth.userId);
  const customer: Record<string, string> = { uniqueId: customerFields.uniqueId };
  if (customerFields.name) customer.name = customerFields.name;
  if (customerFields.email) customer.email = customerFields.email;
  if (customerFields.mobile) customer.mobile = customerFields.mobile;

  // Hosted non-whitelabel: OMIT paymentGateway entirely; include tokens:{}.
  const chargeBody = {
    products: [{
      name: `Order ${merchantRef}`,
      description: "JojoPrompts order",
      price: amountDecimal,
      quantity: 1,
    }],
    order: {
      id: merchantRef,
      reference: merchantRef,
      description: `JojoPrompts order ${merchantRef}`,
      currency: "KWD",
      amount: amountDecimal,
    },
    tokens: {},
    language: body.language ?? "en",
    reference: { id: merchantRef },
    customer,
    returnUrl,
    cancelUrl,
    notificationUrl,
  };

  const res = await providerFetch(cfg, "/charge", { method: "POST", body: chargeBody });

  const recordUnknown = async (kind: string, http?: number | null) => {
    await svc.rpc("v2_record_charge_submission_unknown", {
      p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: attemptId,
      p_http_status: http ?? null,
      p_sanitized_payload: { kind },
    });
  };

  if (res.kind === "timeout" || res.kind === "network_error") {
    await recordUnknown(`provider_${res.kind}`, null);
    return jsonResponse({ error: "recovery_required", reason: res.kind }, 502, origin);
  }
  if (res.kind === "invalid_response") {
    await recordUnknown("provider_invalid_response", res.status ?? null);
    return jsonResponse({ error: "recovery_required", reason: "invalid_response" }, 502, origin);
  }
  if (res.kind === "http_error") {
    await recordUnknown("provider_http_error", res.status);
    return jsonResponse({ error: "recovery_required", reason: "provider_http_error" }, 502, origin);
  }

  // 6. Require official success flag AND valid URL/identifier.
  if (!providerSuccessFlag(res.json)) {
    await svc.rpc("v2_record_charge_submission_unknown", {
      p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: attemptId,
      p_http_status: res.status,
      p_sanitized_payload: sanitizeProviderPayload("charge_status_false", res.json, res.status),
    });
    return jsonResponse({ error: "recovery_required", reason: "provider_rejected" }, 502, origin);
  }

  const extract = extractChargeFields(res.json);
  if (!extract.paymentUrl || !isValidUpaymentsRedirectUrl(extract.paymentUrl)) {
    await svc.rpc("v2_record_charge_submission_unknown", {
      p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: attemptId,
      p_http_status: res.status,
      p_sanitized_payload: sanitizeProviderPayload("charge_invalid_url", res.json, res.status),
    });
    return jsonResponse({ error: "recovery_required", reason: "invalid_redirect" }, 502, origin);
  }
  if (!extract.trackId && !extract.sessionId) {
    await svc.rpc("v2_record_charge_submission_unknown", {
      p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: attemptId,
      p_http_status: res.status,
      p_sanitized_payload: sanitizeProviderPayload("charge_missing_identifier", res.json, res.status),
    });
    return jsonResponse({ error: "recovery_required", reason: "missing_identifier" }, 502, origin);
  }

  const evtId = eventIdForCharge(attemptId,
    extract.trackId ?? extract.sessionId ?? extract.providerOrderId);
  const { error: recErr } = await svc.rpc("v2_record_upayments_charge_response", {
    p_actor_user_id: auth.userId, p_order_id: orderId, p_attempt_id: attemptId,
    p_merchant_reference: merchantRef,
    p_track_id: extract.trackId, p_session_id: extract.sessionId,
    p_provider_order_id: extract.providerOrderId,
    p_checkout_url: extract.paymentUrl,
    p_sanitized_response: sanitizeProviderPayload("charge_response", res.json, res.status),
    p_external_event_id: evtId,
  });
  if (recErr) return jsonResponse({ error: safeRpcError(recErr) }, 500, origin);

  return jsonResponse({ ok: true, order_id: orderId, checkout_url: extract.paymentUrl },
    200, origin);
});
