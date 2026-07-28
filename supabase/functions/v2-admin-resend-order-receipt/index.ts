// v2-admin-resend-order-receipt (verify_jwt=true)
//
// Admin-only endpoint that issues a NEW audited receipt-resend request for
// an existing paid/partially_refunded order and sends a receipt with a
// DISTINCT idempotency key. Never accepts client-supplied recipient, amount,
// items, or email — order data is loaded server-side from canonical rows.
//
// Contract:
//   POST { order_id: uuid, reason: string (3..300) }
//   Any extra field is rejected. No overrides allowed.
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
  loadReceiptOrder,
  receiptResendIdempotencyKey,
  renderReceiptHtml,
  safeProviderMessageId,
  sanitizeErrorCode,
  sanitizeErrorMessage,
  sendReceiptViaResend,
} from "../_shared/v2ReceiptDelivery.ts";
import {
  BODY_BYTES_MAX,
  mapCreateRpcError,
  parseResendBody,
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
  if (raw.length > BODY_BYTES_MAX) return err("body_too_large", 413);
  let parsedJson: unknown;
  try {
    parsedJson = raw ? JSON.parse(raw) : null;
  } catch {
    return err("invalid_body", 400);
  }
  const parsed = parseResendBody(parsedJson);
  if (!parsed.ok) return err(parsed.code, 400);
  const { order_id, reason } = parsed;

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { service, userId } = auth;

  // 1. Create request via service-role RPC.
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
    return json({ ok: false, error: "claim_failed", request_id: requestId }, 500);
  }
  const claim = claimRows[0] as { order_id: string; requested_by: string; claimed: boolean };
  if (!claim.claimed) {
    return json({ ok: false, error: "claim_lost", request_id: requestId }, 409);
  }

  // 3. Load canonical order server-side (allows paid + partially_refunded).
  const order = await loadReceiptOrder(service, order_id, { allowPartialRefund: true });
  if (!order) {
    await service.rpc("v2_internal_fail_receipt_resend_request", {
      p_request_id: requestId,
      p_error_code: "order_load_failed",
      p_error_message: "canonical order or recipient not available",
    });
    return json({ ok: false, error: "order_load_failed", request_id: requestId }, 409);
  }

  // 4. Render + send with the RESEND-scoped idempotency key.
  const siteUrl = Deno.env.get("V2_PUBLIC_SITE_URL") ?? "https://jojoprompts.com";
  const rendered = renderReceiptHtml(order, siteUrl);
  const idempotencyKey = receiptResendIdempotencyKey(requestId);

  let providerId: string | null = null;
  try {
    providerId = await sendReceiptViaResend(order, rendered, idempotencyKey);
  } catch (sendErr) {
    const msg = sanitizeErrorMessage((sendErr as Error)?.message ?? "resend_send_failed");
    await service.rpc("v2_internal_fail_receipt_resend_request", {
      p_request_id: requestId,
      p_error_code: sanitizeErrorCode("resend_send_failed"),
      p_error_message: msg,
    });
    await logResendAttempt(service, {
      orderId: order_id,
      requestId,
      userId: order.user_id,
      email: order.user_email,
      success: false,
      errorCode: "resend_send_failed",
      errorMessage: msg,
    });
    return json({ ok: false, error: "resend_send_failed", request_id: requestId }, 502);
  }

  // 5. Complete request. If provider succeeded but DB complete fails, return
  //    a distinct reconciliation status instead of blindly retrying.
  const safeProviderId = safeProviderMessageId(providerId);
  const { data: completeOk, error: completeErr } = await service.rpc(
    "v2_internal_complete_receipt_resend_request",
    { p_request_id: requestId, p_provider_message_id: safeProviderId },
  );
  if (completeErr || completeOk !== true) {
    await logResendAttempt(service, {
      orderId: order_id,
      requestId,
      userId: order.user_id,
      email: order.user_email,
      success: true,
      providerMessageId: safeProviderId,
      errorMessage: "db_complete_failed",
    });
    return json({
      ok: false,
      error: "reconciliation_required",
      request_id: requestId,
      provider_message_id: safeProviderId,
    }, 202);
  }

  await logResendAttempt(service, {
    orderId: order_id,
    requestId,
    userId: order.user_id,
    email: order.user_email,
    success: true,
    providerMessageId: safeProviderId,
  });

  return json({
    ok: true,
    request_id: requestId,
    provider_message_id: safeProviderId,
  }, 200);
});
