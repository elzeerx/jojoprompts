// v2-admin-resend-order-receipt (verify_jwt=true)
//
// Admin-only endpoint that issues a NEW audited receipt-resend request for
// an existing paid/partially_refunded order and sends a receipt with a
// DISTINCT idempotency key. Never accepts client-supplied recipient, amount,
// items, or email — order data is loaded server-side from canonical rows.
//
// Contract:
//   POST { order_id: uuid, reason: string (3..300) }  -> new resend
//   POST { request_id: uuid }                         -> reconcile the SAME
//                                                        ambiguous resend
//   POST { request_id, resolution, reason }           -> record an explicit
//                                                        manual provider review
//   Any extra field is rejected. No overrides allowed. Reconciliation uses
//   the persisted provider payload and original idempotency key.
//
// Guardrails:
//   - Admin JWT + has_role('admin') check
//   - Service-role RPCs only mutate the request row (create/claim/complete/fail)
//   - Original v2_order_receipt_deliveries row and its idempotency key
//     are UNTOUCHED
//   - Provider-success / DB-complete-failure returns a distinct
//     "reconciliation_required" status; no blind retry with a different key
//   - email_logs entries use email_type = 'v2_order_receipt_resend' so the
//     one-success-per-order partial index on v2_order_receipt does not hide
//     resend outcomes.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  buildReceiptProviderPayload,
  loadReceiptOrder,
  ReceiptDeliveryError,
  type ReceiptProviderPayload,
  receiptResendIdempotencyKey,
  renderReceiptHtml,
  safeProviderMessageId,
  sanitizeErrorCode,
  sanitizeErrorMessage,
  sendReceiptPayloadViaResend,
} from "../_shared/v2ReceiptDelivery.ts";
import {
  BODY_BYTES_MAX,
  mapCreateRpcError,
  parseReceiptResendCommand,
} from "./decisions.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(code: string, status = 400): Response {
  return json({ ok: false, error: code }, status);
}

async function requireAdmin(req: Request): Promise<
  | { ok: true; userId: string; service: SupabaseClient }
  | { ok: false; res: Response }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { ok: false, res: err("unauthorized", 401) };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) return { ok: false, res: err("unauthorized", 401) };
  const userId = data.claims.sub as string;

  const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isAdmin, error: roleErr } = await service.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleErr || !isAdmin) return { ok: false, res: err("forbidden", 403) };
  return { ok: true, userId, service };
}

async function logResendAttempt(
  svc: SupabaseClient,
  args: {
    orderId: string;
    requestId: string;
    userId: string | null;
    email: string;
    success: boolean;
    providerMessageId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  try {
    const meta: Record<string, unknown> = {
      order_id: args.orderId,
      resend_request_id: args.requestId,
    };
    if (args.providerMessageId) meta.provider_message_id = args.providerMessageId;
    await svc.from("email_logs").insert({
      email_address: args.email || "unknown@invalid",
      email_type: "v2_order_receipt_resend",
      success: args.success,
      error_message: args.success ? null : sanitizeErrorMessage(args.errorMessage ?? "unknown_error"),
      user_id: args.userId,
      delivery_status: args.success ? "sent" : "failed",
      response_metadata: meta,
    });
  } catch {
    /* logging must never fail the outer call */
  }
}

async function markResendFailed(
  svc: SupabaseClient,
  requestId: string,
  errorCode: string,
  errorMessage: string,
): Promise<boolean> {
  try {
    const { data, error } = await svc.rpc(
      "v2_internal_fail_receipt_resend_request",
      {
        p_request_id: requestId,
        p_error_code: sanitizeErrorCode(errorCode),
        p_error_message: sanitizeErrorMessage(errorMessage),
      },
    );
    return !error && data === true;
  } catch {
    return false;
  }
}

async function markReconciliationRequired(
  svc: SupabaseClient,
  requestId: string,
  errorCode: string,
  errorMessage: string,
  providerMessageId: string | null = null,
): Promise<boolean> {
  try {
    const { data, error } = await svc.rpc(
      "v2_internal_require_receipt_resend_reconciliation",
      {
        p_request_id: requestId,
        p_error_code: sanitizeErrorCode(errorCode),
        p_error_message: sanitizeErrorMessage(errorMessage),
        p_provider_message_id: safeProviderMessageId(providerMessageId),
      },
    );
    return !error && data === true;
  } catch {
    return false;
  }
}

function reconciliationRequired(
  requestId: string,
  providerMessageId: string | null = null,
): Response {
  return json({
    ok: false,
    error: "reconciliation_required",
    request_id: requestId,
    ...(providerMessageId ? { provider_message_id: providerMessageId } : {}),
  }, 202);
}

interface PersistedReceiptPayload {
  payload: ReceiptProviderPayload;
  recipientUserId: string | null;
}

function parsePersistedPayload(raw: unknown): PersistedReceiptPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const strings = [
    "from_header",
    "recipient_email",
    "reply_to",
    "subject",
    "html_body",
    "text_body",
  ] as const;
  for (const key of strings) {
    if (typeof row[key] !== "string" || (row[key] as string).length === 0) return null;
  }
  if (
    !row.provider_headers ||
    typeof row.provider_headers !== "object" ||
    Array.isArray(row.provider_headers)
  ) return null;
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(row.provider_headers as Record<string, unknown>)) {
    if (typeof value !== "string") return null;
    headers[key] = value;
  }
  return {
    payload: {
      from: row.from_header as string,
      to: row.recipient_email as string,
      reply_to: row.reply_to as string,
      subject: row.subject as string,
      html: row.html_body as string,
      text: row.text_body as string,
      headers,
    },
    recipientUserId: typeof row.recipient_user_id === "string"
      ? row.recipient_user_id
      : null,
  };
}

async function persistReceiptPayload(
  svc: SupabaseClient,
  requestId: string,
  recipientUserId: string | null,
  payload: ReceiptProviderPayload,
): Promise<boolean> {
  try {
    const { error } = await svc.from("v2_order_receipt_resend_payloads").insert({
      request_id: requestId,
      from_header: payload.from,
      recipient_user_id: recipientUserId,
      recipient_email: payload.to,
      reply_to: payload.reply_to,
      subject: payload.subject,
      html_body: payload.html,
      text_body: payload.text,
      provider_headers: payload.headers,
    });
    return !error;
  } catch {
    return false;
  }
}

async function loadPersistedReceiptPayload(
  svc: SupabaseClient,
  requestId: string,
): Promise<PersistedReceiptPayload | null> {
  try {
    const { data, error } = await svc
      .from("v2_order_receipt_resend_payloads")
      .select(
        "from_header, recipient_user_id, recipient_email, reply_to, subject, html_body, text_body, provider_headers",
      )
      .eq("request_id", requestId)
      .maybeSingle();
    if (error) return null;
    return parsePersistedPayload(data);
  } catch {
    return null;
  }
}

async function deliverPersistedReceipt(
  svc: SupabaseClient,
  args: {
    orderId: string;
    requestId: string;
    recipientUserId: string | null;
    payload: ReceiptProviderPayload;
  },
): Promise<Response> {
  const idempotencyKey = receiptResendIdempotencyKey(args.requestId);
  let providerId: string | null = null;
  try {
    providerId = await sendReceiptPayloadViaResend(args.payload, idempotencyKey);
  } catch (sendErr) {
    const msg = sanitizeErrorMessage((sendErr as Error)?.message ?? "resend_send_failed");
    if (
      !(sendErr instanceof ReceiptDeliveryError) ||
      sendErr.disposition === "unknown"
    ) {
      await markReconciliationRequired(
        svc,
        args.requestId,
        "delivery_outcome_unknown",
        msg,
      );
      return reconciliationRequired(args.requestId);
    }
    const closed = await markResendFailed(
      svc,
      args.requestId,
      "resend_send_failed",
      msg,
    );
    if (!closed) return reconciliationRequired(args.requestId);
    await logResendAttempt(svc, {
      orderId: args.orderId,
      requestId: args.requestId,
      userId: args.recipientUserId,
      email: args.payload.to,
      success: false,
      errorCode: "resend_send_failed",
      errorMessage: msg,
    });
    return json({
      ok: false,
      error: "resend_send_failed",
      request_id: args.requestId,
    }, 502);
  }

  const safeProviderId = safeProviderMessageId(providerId);
  const { data: completeOk, error: completeErr } = await svc.rpc(
    "v2_internal_complete_receipt_resend_request",
    {
      p_request_id: args.requestId,
      p_provider_message_id: safeProviderId,
    },
  );
  if (completeErr || completeOk !== true) {
    await markReconciliationRequired(
      svc,
      args.requestId,
      "db_complete_failed",
      "provider accepted delivery but database completion failed",
      safeProviderId,
    );
    return reconciliationRequired(args.requestId, safeProviderId);
  }

  await logResendAttempt(svc, {
    orderId: args.orderId,
    requestId: args.requestId,
    userId: args.recipientUserId,
    email: args.payload.to,
    success: true,
    providerMessageId: safeProviderId,
  });

  return json({
    ok: true,
    request_id: args.requestId,
    provider_message_id: safeProviderId,
  }, 200);
}

function reconciliationClaimError(code: string | null | undefined): Response {
  const safeCode = code || "reconciliation_claim_failed";
  const status = safeCode === "forbidden"
    ? 403
    : safeCode === "request_not_found"
      ? 404
      : safeCode === "reconciliation_attempt_cap_exceeded"
        ? 429
        : 409;
  return err(safeCode, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("method_not_allowed", 405);

  // Bounded body read.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return err("invalid_body", 400);
  }
  if (new TextEncoder().encode(raw).byteLength > BODY_BYTES_MAX) {
    return err("body_too_large", 413);
  }
  let parsedJson: unknown;
  try {
    parsedJson = raw ? JSON.parse(raw) : null;
  } catch {
    return err("invalid_body", 400);
  }
  const command = parseReceiptResendCommand(parsedJson);
  if (!command.ok) return err(command.code, 400);

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { service, userId } = auth;

  if (command.mode === "resolve") {
    const { data, error } = await service.rpc(
      "v2_internal_resolve_receipt_resend_reconciliation",
      {
        p_request_id: command.request_id,
        p_admin_user_id: userId,
        p_resolution: command.resolution,
        p_reason: command.reason,
      },
    );
    if (error || data !== true) return err("manual_resolution_failed", 409);
    return json({
      ok: true,
      request_id: command.request_id,
      resolution: command.resolution,
    });
  }

  if (command.mode === "reconcile") {
    const { data: claimRows, error: claimErr } = await service.rpc(
      "v2_internal_claim_receipt_resend_reconciliation",
      {
        p_request_id: command.request_id,
        p_admin_user_id: userId,
      },
    );
    if (claimErr || !Array.isArray(claimRows) || claimRows.length === 0) {
      return err("reconciliation_claim_failed", 500);
    }
    const claim = claimRows[0] as {
      order_id: string | null;
      requested_by: string | null;
      claimed: boolean;
      claim_error_code: string | null;
    };
    if (!claim.claimed || !claim.order_id) {
      return reconciliationClaimError(claim.claim_error_code);
    }

    const stored = await loadPersistedReceiptPayload(service, command.request_id);
    if (!stored) {
      const closed = await markResendFailed(
        service,
        command.request_id,
        "payload_snapshot_missing",
        "persisted provider payload is unavailable",
      );
      if (!closed) return reconciliationRequired(command.request_id);
      return json({
        ok: false,
        error: "payload_snapshot_missing",
        request_id: command.request_id,
      }, 409);
    }
    return deliverPersistedReceipt(service, {
      orderId: claim.order_id,
      requestId: command.request_id,
      recipientUserId: stored.recipientUserId,
      payload: stored.payload,
    });
  }

  const { order_id, reason } = command;

  // 1. Create a new request via the service-role RPC.
  let requestId: string;
  try {
    const { data, error } = await service.rpc("v2_internal_create_receipt_resend_request", {
      p_order_id: order_id,
      p_admin_user_id: userId,
      p_reason: reason,
    });
    if (error) {
      const mapped = mapCreateRpcError(error.message ?? "");
      return err(mapped.code, mapped.status);
    }
    if (!data || typeof data !== "string") return err("resend_request_failed", 500);
    requestId = data;
  } catch (e) {
    const mapped = mapCreateRpcError((e as Error)?.message ?? "");
    return err(mapped.code, mapped.status);
  }

  // 2. Claim.
  const { data: claimRows, error: claimErr } = await service.rpc(
    "v2_internal_claim_receipt_resend_request",
    { p_request_id: requestId },
  );
  if (claimErr || !Array.isArray(claimRows) || claimRows.length === 0) {
    const closed = await markResendFailed(
      service,
      requestId,
      "claim_failed",
      "request could not be claimed before provider delivery",
    );
    if (!closed) return reconciliationRequired(requestId);
    return json({ ok: false, error: "claim_failed", request_id: requestId }, 500);
  }
  const claim = claimRows[0] as { order_id: string; requested_by: string; claimed: boolean };
  if (!claim.claimed) {
    return reconciliationRequired(requestId);
  }

  // 3. Load canonical order server-side (allows paid + partially_refunded).
  const order = await loadReceiptOrder(service, order_id, { allowPartialRefund: true });
  if (!order) {
    const closed = await markResendFailed(
      service,
      requestId,
      "order_load_failed",
      "canonical order or recipient not available",
    );
    if (!closed) return reconciliationRequired(requestId);
    return json({ ok: false, error: "order_load_failed", request_id: requestId }, 409);
  }

  // 4. Render and persist the exact provider payload before the first send.
  //    A reconciliation must reuse both this payload and this request's key.
  const siteUrl = Deno.env.get("V2_PUBLIC_SITE_URL") ?? "https://jojoprompts.com";
  const rendered = renderReceiptHtml(order, siteUrl);
  const payload = buildReceiptProviderPayload(order, rendered);
  const stored = await persistReceiptPayload(
    service,
    requestId,
    order.user_id,
    payload,
  );
  if (!stored) {
    const closed = await markResendFailed(
      service,
      requestId,
      "payload_snapshot_failed",
      "provider payload could not be persisted before delivery",
    );
    if (!closed) return reconciliationRequired(requestId);
    return json({
      ok: false,
      error: "payload_snapshot_failed",
      request_id: requestId,
    }, 500);
  }

  // 5. Send and complete. The shared delivery helper transitions ambiguous
  //    outcomes to reconciliation_required and never invents a new key.
  return deliverPersistedReceipt(service, {
    orderId: order_id,
    requestId,
    recipientUserId: order.user_id,
    payload,
  });
});
