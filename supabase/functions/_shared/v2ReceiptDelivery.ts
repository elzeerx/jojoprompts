// V2 Post-Purchase Receipt Delivery — shared module.
//
// Imported by v2-upayments-webhook and v2-upayments-status only AFTER the
// verified settlement RPC has succeeded. Uses EdgeRuntime.waitUntil so any
// receipt latency or failure never blocks/rolls back payment settlement.
//
// Contract:
//   scheduleReceiptDelivery(svc, orderId, req)
//     - never throws
//     - schedules a background task via EdgeRuntime.waitUntil when available;
//       otherwise falls back to fire-and-forget with an error swallow
//     - inside the task: claim -> render -> invoke send-email -> complete/fail
//
// Rendering: bilingual (EN + AR) single email. HTML-escapes all DB text.
// Never embeds secrets, raw provider payloads, or permanent download URLs.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { createEdgeLogger } from "./logger.ts";

const logger = createEdgeLogger("v2-receipt-delivery");

// Verified Jojo sender/reply-to (same as legacy send-email transport).
const RECEIPT_FROM = "JoJo Prompts <info@jojoprompts.com>";
const RECEIPT_REPLY_TO = "info@jojoprompts.com";

/**
 * Deterministic Resend idempotency key derived only from the order id.
 * Bounded to Resend's <=256 char limit. Same order_id => same key across
 * retries, so a crash after provider acceptance cannot duplicate the send.
 */
export function receiptIdempotencyKey(orderId: string): string {
  const id = typeof orderId === "string" ? orderId.trim() : "";
  if (!id) throw new Error("receiptIdempotencyKey: empty orderId");
  const key = `v2-order-receipt/${id}`;
  return key.length > 256 ? key.slice(0, 256) : key;
}

// ---------------------------------------------------------------- Pure helpers

/** HTML-escape any string safely for use inside element text or attribute values. */
export function escapeHtml(input: unknown): string {
  const s = input == null ? "" : String(input);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format an integer fils amount as KWD with 3-decimal precision.
 * Rejects negative, non-finite, and non-integer inputs.
 */
export function formatKwd(fils: unknown): string {
  const n = typeof fils === "number" ? fils : Number(fils);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return "0.000 KWD";
  const kwd = (n / 1000).toFixed(3);
  return `${kwd} KWD`;
}

/** Truncate + normalize provider-returned ids used inside the outbox row. */
export function safeProviderMessageId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
}

/** Sanitize error message stored on the outbox row / logged out. */
export function sanitizeErrorMessage(msg: unknown): string {
  if (typeof msg !== "string") return "unknown_error";
  const trimmed = msg.trim();
  if (!trimmed) return "unknown_error";
  return trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed;
}

/** Sanitize error code — must match the DB regex to not be rewritten. */
export function sanitizeErrorCode(code: unknown): string {
  if (typeof code !== "string") return "unknown";
  const trimmed = code.trim();
  if (!trimmed) return "unknown";
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(trimmed)) return "invalid_error_code";
  return trimmed;
}

export interface ReceiptLine {
  title_en: string | null;
  title_ar: string | null;
  resource_type: string | null;
  quantity: number;
  unit_price_fils: number;
  line_total_fils: number;
}

export interface ReceiptOrder {
  order_id: string;
  order_number: string;
  settled_at: string | null;
  currency: string;
  subtotal_fils: number;
  discount_fils: number;
  total_fils: number;
  user_email: string;
  user_id: string | null;
  provider: string;
  lines: ReceiptLine[];
}

/** Render one bilingual EN/AR line row as HTML. Escapes every DB value. */
export function renderReceiptLineHtml(line: ReceiptLine): string {
  const titleEn = escapeHtml(line.title_en ?? "");
  const titleAr = escapeHtml(line.title_ar ?? "");
  const rtype = escapeHtml(line.resource_type ?? "");
  const qty = Number.isInteger(line.quantity) && line.quantity > 0 ? line.quantity : 1;
  const unit = formatKwd(line.unit_price_fils);
  const total = formatKwd(line.line_total_fils);
  const titleBlock = titleEn && titleAr
    ? `${titleEn}<br><span style="direction:rtl">${titleAr}</span>`
    : titleEn
      ? titleEn
      : titleAr
        ? `<span style="direction:rtl">${titleAr}</span>`
        : "&mdash;";
  const rtypeBlock = rtype
    ? `<div style="font-size:12px;color:#666">${rtype}</div>`
    : "";
  return `<tr>
    <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top">
      <div style="font-weight:600">${titleBlock}</div>
      ${rtypeBlock}
    </td>
    <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${qty}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(unit)}</td>
    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(total)}</td>
  </tr>`;
}

/** Render the full transactional receipt (bilingual, single template). */
export function renderReceiptHtml(order: ReceiptOrder, siteUrl: string): {
  subject: string;
  html: string;
  text: string;
} {
  const orderNumber = escapeHtml(order.order_number);
  const settled = escapeHtml(
    order.settled_at ? new Date(order.settled_at).toISOString().slice(0, 19).replace("T", " ") + " UTC" : "",
  );
  const provider = escapeHtml(order.provider || "UPayments");
  const currency = escapeHtml((order.currency || "KWD").toUpperCase());
  const subtotal = formatKwd(order.subtotal_fils);
  const discount = formatKwd(order.discount_fils);
  const total = formatKwd(order.total_fils);
  const showDiscount = Number.isInteger(order.discount_fils) && order.discount_fils > 0;

  const linesHtml = order.lines.map(renderReceiptLineHtml).join("\n");

  const libraryUrl = `${siteUrl.replace(/\/+$/, "")}/library`;
  const ordersUrl = `${siteUrl.replace(/\/+$/, "")}/orders`;

  const subject = `JojoPrompts receipt for order ${orderNumber} — إيصال طلب ${orderNumber}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Arial,Helvetica,sans-serif;color:#262626">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f0;padding:24px 0">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">
      <tr>
        <td style="background:#c49d68;padding:20px 24px;color:#ffffff">
          <div style="font-size:20px;font-weight:700">JojoPrompts</div>
          <div style="font-size:14px;opacity:.9">Payment receipt / إيصال الدفع</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px">
          <p style="margin:0 0 8px 0"><strong>Order number:</strong> ${orderNumber}</p>
          <p style="margin:0 0 8px 0"><strong>Settled:</strong> ${settled}</p>
          <p style="margin:0 0 8px 0"><strong>Payment provider:</strong> ${provider}</p>
          <p style="margin:0 0 16px 0"><strong>Currency:</strong> ${currency}</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:16px 0">
            <thead>
              <tr>
                <th align="left" style="padding:8px;border-bottom:2px solid #262626;font-size:12px">Item / العنصر</th>
                <th align="center" style="padding:8px;border-bottom:2px solid #262626;font-size:12px">Qty</th>
                <th align="right" style="padding:8px;border-bottom:2px solid #262626;font-size:12px">Unit</th>
                <th align="right" style="padding:8px;border-bottom:2px solid #262626;font-size:12px">Total</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">
            <tr>
              <td style="padding:4px 8px;text-align:right;color:#666">Subtotal</td>
              <td style="padding:4px 8px;text-align:right;width:140px">${escapeHtml(subtotal)}</td>
            </tr>
            ${showDiscount ? `<tr>
              <td style="padding:4px 8px;text-align:right;color:#666">Discount</td>
              <td style="padding:4px 8px;text-align:right">-${escapeHtml(discount)}</td>
            </tr>` : ""}
            <tr>
              <td style="padding:8px;text-align:right;font-weight:700;border-top:1px solid #eee">Total / الإجمالي</td>
              <td style="padding:8px;text-align:right;font-weight:700;border-top:1px solid #eee">${escapeHtml(total)}</td>
            </tr>
          </table>

          <div style="margin:24px 0 8px 0">
            <a href="${escapeHtml(libraryUrl)}" style="display:inline-block;background:#7a9e9f;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none;margin-right:8px">Go to My Library</a>
            <a href="${escapeHtml(ordersUrl)}" style="display:inline-block;background:#262626;color:#fff;padding:10px 16px;border-radius:4px;text-decoration:none">View Orders</a>
          </div>

          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">

          <div style="direction:rtl;text-align:right;font-family:Tahoma,Arial,sans-serif">
            <p style="margin:0 0 8px 0"><strong>رقم الطلب:</strong> ${orderNumber}</p>
            <p style="margin:0 0 8px 0"><strong>وسيلة الدفع:</strong> ${provider}</p>
            <p style="margin:0 0 8px 0"><strong>الإجمالي:</strong> ${escapeHtml(total)}</p>
            <p style="margin:0">شكراً لشرائك من JojoPrompts. يمكنك الوصول إلى مشترياتك من "مكتبتي".</p>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px;background:#efeee9;color:#666;font-size:12px;text-align:center">
          Need help? info@jojoprompts.com &middot; للمساعدة راسلنا
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    `JojoPrompts — Payment receipt`,
    `Order: ${order.order_number}`,
    `Settled: ${order.settled_at ?? ""}`,
    `Provider: ${order.provider || "UPayments"}`,
    `Total: ${total}`,
    ``,
    `Library: ${libraryUrl}`,
    `Orders:  ${ordersUrl}`,
  ].join("\n");

  return { subject, html, text };
}

// -------------------------------------------------------- Scheduling glue

interface ScheduleOptions {
  /** Optional override, primarily for tests. */
  siteUrl?: string;
}

function schedule(fn: () => Promise<void>): void {
  try {
    const anyGlobal = globalThis as unknown as {
      EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void };
    };
    if (anyGlobal.EdgeRuntime?.waitUntil) {
      anyGlobal.EdgeRuntime.waitUntil(
        fn().catch((e) => logger.error("receipt task failed", { error: (e as Error)?.message })),
      );
      return;
    }
  } catch (_) { /* fall through */ }
  // Fallback fire-and-forget; never rethrow.
  fn().catch((e) => logger.error("receipt task failed (fallback)", { error: (e as Error)?.message }));
}

/** Best-effort load of the current site URL for links inside the receipt. */
function resolveSiteUrl(explicit?: string): string {
  const raw = (explicit ?? Deno.env.get("V2_PUBLIC_SITE_URL") ?? "https://jojoprompts.com").trim();
  return raw || "https://jojoprompts.com";
}

/**
 * Assemble the receipt data payload from the DB. Uses only trusted fields.
 * Returns null when the order is not paid or not readable.
 */
async function loadReceiptOrder(svc: SupabaseClient, orderId: string): Promise<ReceiptOrder | null> {
  const { data: order, error } = await svc
    .from("orders")
    .select("id, order_number, status, currency, subtotal_fils, discount_fils, total_fils, settled_at, provider, user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order || order.status !== "paid") return null;

  const [{ data: items }, { data: profile }] = await Promise.all([
    svc.from("order_items")
      .select("product_id, resource_id, quantity, unit_price_fils, line_total_fils")
      .eq("order_id", orderId),
    order.user_id
      ? svc.from("profiles").select("email").eq("id", order.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const resourceIds = Array.from(new Set(
    ((items ?? []) as Array<{ resource_id: string | null }>)
      .map((r) => r.resource_id)
      .filter((v): v is string => typeof v === "string"),
  ));
  let resourceById = new Map<string, { title_en: string | null; title_ar: string | null; type: string | null }>();
  if (resourceIds.length > 0) {
    const { data: rs } = await svc
      .from("resources")
      .select("id, title_en, title_ar, type")
      .in("id", resourceIds);
    (rs ?? []).forEach((r: { id: string; title_en: string | null; title_ar: string | null; type: string | null }) => {
      resourceById.set(r.id, { title_en: r.title_en, title_ar: r.title_ar, type: r.type });
    });
  }

  const lines: ReceiptLine[] = ((items ?? []) as Array<{
    product_id: string; resource_id: string | null; quantity: number;
    unit_price_fils: number; line_total_fils: number;
  }>).map((row) => {
    const r = row.resource_id ? resourceById.get(row.resource_id) : undefined;
    return {
      title_en: r?.title_en ?? null,
      title_ar: r?.title_ar ?? null,
      resource_type: r?.type ?? null,
      quantity: Number.isInteger(row.quantity) && row.quantity > 0 ? row.quantity : 1,
      unit_price_fils: row.unit_price_fils ?? 0,
      line_total_fils: row.line_total_fils ?? 0,
    };
  });

  const email = (profile as { email?: string | null } | null)?.email;
  if (!email) return null;

  return {
    order_id: order.id,
    order_number: order.order_number,
    settled_at: order.settled_at,
    currency: order.currency ?? "KWD",
    subtotal_fils: order.subtotal_fils ?? 0,
    discount_fils: order.discount_fils ?? 0,
    total_fils: order.total_fils ?? 0,
    user_email: email,
    user_id: order.user_id,
    provider: (order.provider ?? "upayments").toString().toLowerCase() === "upayments" ? "UPayments" : (order.provider ?? "UPayments"),
    lines,
  };
}

/**
 * Write a compact email_logs row for this receipt attempt.
 * response_metadata is intentionally minimal: order_id, order_number,
 * delivery_id, provider_message_id. No HTML, no raw provider payload.
 * A partial unique index on (response_metadata->>'order_id') guarantees
 * at most one success row per order; a duplicate insert is swallowed.
 */
async function logAttempt(
  svc: SupabaseClient,
  args: {
    order: ReceiptOrder | null;
    orderId: string;
    deliveryId: string | null;
    success: boolean;
    providerMessageId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  try {
    const meta: Record<string, unknown> = { order_id: args.orderId };
    if (args.deliveryId) meta.delivery_id = args.deliveryId;
    if (args.order?.order_number) meta.order_number = args.order.order_number;
    if (args.providerMessageId) meta.provider_message_id = args.providerMessageId;

    const { error } = await svc.from("email_logs").insert({
      email_address: args.order?.user_email ?? "unknown@invalid",
      email_type: "v2_order_receipt",
      success: args.success,
      error_message: args.success ? null : sanitizeErrorMessage(args.errorMessage ?? "unknown_error"),
      user_id: args.order?.user_id ?? null,
      delivery_status: args.success ? "sent" : "failed",
      response_metadata: meta,
    });
    // 23505 = unique violation on the success-per-order partial index.
    if (error && (error as { code?: string }).code !== "23505") {
      logger.error("email_logs insert failed", { error: error.message });
    }
  } catch (e) {
    logger.error("email_logs insert threw", { error: (e as Error)?.message });
  }
}

/**
 * Send the rendered receipt via Resend directly, using a stable idempotency
 * key. Returns the provider message id (may be null) on success, throws on
 * failure. Transactional receipts must NOT be blocked by marketing
 * unsubscribe state — no such check is performed here.
 */
async function sendReceiptViaResend(
  order: ReceiptOrder,
  rendered: { subject: string; html: string; text: string },
): Promise<string | null> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("resend_api_key_missing");
  const resend = new Resend(apiKey);

  const payload = {
    from: RECEIPT_FROM,
    to: order.user_email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    reply_to: RECEIPT_REPLY_TO,
    headers: {
      "Precedence": "transactional",
      "Auto-Submitted": "auto-generated",
      "List-Unsubscribe": "<mailto:unsubscribe@jojoprompts.com>",
    },
  };
  const options = { idempotencyKey: receiptIdempotencyKey(order.order_id) };

  // Resend SDK v2: send(payload, options?) — options carries idempotencyKey.
  // Cast because older type defs may omit the second arg.
  const result = await (resend.emails.send as unknown as (
    p: typeof payload,
    o: typeof options,
  ) => Promise<{ data?: { id?: string } | null; error?: { name?: string; message?: string } | null; id?: string }>)(
    payload,
    options,
  );

  if (result?.error) {
    const name = result.error.name ?? "resend_error";
    const msg = result.error.message ?? "resend send failed";
    throw new Error(`${name}: ${msg}`);
  }
  return safeProviderMessageId(result?.data?.id ?? result?.id ?? null);
}

/**
 * Schedule a receipt-delivery attempt for the given order in the background.
 * MUST only be called after a successful settlement RPC has returned.
 */
export function scheduleReceiptDelivery(
  svc: SupabaseClient,
  orderId: string,
  opts: ScheduleOptions = {},
): void {
  const siteUrl = resolveSiteUrl(opts.siteUrl);
  schedule(async () => {
    // 1) Claim
    const { data: claim, error: clErr } = await svc.rpc("v2_claim_order_receipt_delivery", {
      p_order_id: orderId,
    });
    if (clErr) {
      logger.error("claim rpc error", { orderId, error: clErr.message });
      return;
    }
    const row = Array.isArray(claim) ? claim[0] : claim;
    if (!row || row.claimed !== true) {
      logger.info("receipt not claimed", { orderId, reason: row ? "not_eligible" : "no_row" });
      return;
    }
    const deliveryId: string = row.delivery_id;

    // 2) Load canonical order data
    const order = await loadReceiptOrder(svc, orderId);
    if (!order) {
      await svc.rpc("v2_fail_order_receipt_delivery", {
        p_delivery_id: deliveryId,
        p_error_code: "order_unreadable",
        p_error_message: "order not readable or missing email",
      });
      await logAttempt(svc, {
        order: null, orderId, deliveryId,
        success: false, errorCode: "order_unreadable", errorMessage: "order_unreadable",
      });
      return;
    }

    // 3) Render + send via Resend directly (stable idempotency key)
    let providerMsgId: string | null = null;
    try {
      const rendered = renderReceiptHtml(order, siteUrl);
      providerMsgId = await sendReceiptViaResend(order, rendered);
    } catch (e) {
      const rawMsg = (e as Error)?.message || "send_failed";
      const safeMsg = sanitizeErrorMessage(rawMsg);
      const code = rawMsg === "resend_api_key_missing" ? "resend_api_key_missing" : "send_failed";
      await svc.rpc("v2_fail_order_receipt_delivery", {
        p_delivery_id: deliveryId,
        p_error_code: sanitizeErrorCode(code),
        p_error_message: safeMsg,
      });
      await logAttempt(svc, { order, orderId, deliveryId, success: false, errorCode: code, errorMessage: safeMsg });
      return;
    }

    // 4) Mark complete — only log success if the RPC actually transitioned the row.
    const { data: cmpData, error: cmpErr } = await svc.rpc("v2_complete_order_receipt_delivery", {
      p_delivery_id: deliveryId,
      p_provider_message_id: providerMsgId,
    });
    if (cmpErr) {
      logger.error("complete rpc error (email likely sent; idempotency-key prevents duplicate on retry)", {
        orderId, error: cmpErr.message,
      });
      return; // no success log until DB confirms the transition
    }
    const confirmed = cmpData === true;
    if (!confirmed) {
      logger.info("complete rpc reported no-op (already sent or not processing)", { orderId, deliveryId });
      return;
    }
    await logAttempt(svc, {
      order, orderId, deliveryId, success: true, providerMessageId: providerMsgId,
    });
  });
}

