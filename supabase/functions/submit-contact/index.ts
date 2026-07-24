// supabase/functions/submit-contact/index.ts
//
// Public contact-form endpoint. Server owns recipients, subjects, HTML,
// and text — the browser cannot inject any of them. Anonymous by design,
// so it enforces its own rate limits (per hashed IP and hashed email)
// and never persists raw identifiers or the contact message.
//
// Idempotency: we set the real Resend HTTP `Idempotency-Key` header per
// leg (confirmation, admin). `X-Entity-Ref-ID` is only useful for mail
// threading and is NOT a dedupe mechanism — we no longer rely on it for
// idempotency and it has been removed to avoid the misleading signal.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { validateContact, validateSubmissionId, type ParsedContact } from './validation.ts';
import {
  jsonResponse,
  methodGuardPost,
  readBoundedJson,
  escapeHtml,
  nl2brSafe,
  hmacSha256Hex,
  ipFromReq,
  corsHeadersFor,
} from '../_shared/emailCommon.ts';
import { resendIdempotencyKey, sendResendEmail } from '../_shared/resendClient.ts';

const ADMIN_RECIPIENT = 'info@jojoprompts.com';
// Fully server-fixed admin subject: never interpolates user-controlled
// text, so header-injection via CR/LF in a submitted name is impossible.
const ADMIN_FIXED_SUBJECT = 'New contact form submission';

export { validateContact, validateSubmissionId, corsHeadersFor };

// Defence-in-depth CR/LF stripper for any user text we drop into a header
// or subject. Body/text rendering already escapes HTML; this is for header
// contexts (subject fallback, etc.).
function stripCrlf(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

function renderConfirmation(p: ParsedContact) {
  const subject = 'We received your message';
  const nameEsc = escapeHtml(p.name);
  const subjEsc = escapeHtml(p.subject);
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
<h1 style="font-size:18px;color:#333;margin:0 0 10px 0;">Thanks, ${nameEsc}</h1>
<p style="color:#555;font-size:14px;">We received your message about "<strong>${subjEsc}</strong>" and will reply within 24 hours.</p>
<p style="color:#555;font-size:14px;">If you did not submit this form, you can ignore this email.</p>
<p style="color:#888;font-size:12px;margin-top:24px;">— The JoJo Prompts team</p>
</body></html>`;
  const text = `Thanks, ${stripCrlf(p.name)}\n\nWe received your message about "${stripCrlf(p.subject)}" and will reply within 24 hours.\n\nIf you did not submit this form, you can ignore this email.\n\n— The JoJo Prompts team`;
  return { subject, html, text };
}

function renderAdminNotification(p: ParsedContact) {
  const subject = ADMIN_FIXED_SUBJECT;
  const nameEsc = escapeHtml(p.name);
  const emailEsc = escapeHtml(p.email);
  const subjEsc = escapeHtml(p.subject);
  const msgHtml = nl2brSafe(p.message);
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
<h1 style="font-size:18px;color:#333;">New contact form submission</h1>
<p style="color:#555;font-size:14px;"><strong>Name:</strong> ${nameEsc}</p>
<p style="color:#555;font-size:14px;"><strong>Email:</strong> ${emailEsc}</p>
<p style="color:#555;font-size:14px;"><strong>Subject:</strong> ${subjEsc}</p>
<div style="color:#333;font-size:14px;padding:12px;border-left:3px solid #c49d68;background:#faf8f4;">${msgHtml}</div>
</body></html>`;
  const text = `New contact form submission\n\nName: ${p.name}\nEmail: ${p.email}\nSubject: ${p.subject}\n\n${p.message}`;
  return { subject, html, text };
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  const guard = methodGuardPost(req);
  if (guard) return guard;

  const parsed = await readBoundedJson<Record<string, unknown>>(req);
  if (!parsed.ok) {
    return jsonResponse({ success: false, error: parsed.error }, parsed.status, origin);
  }
  const raw = parsed.body ?? {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return jsonResponse({ success: false, error: 'invalid_body' }, 400, origin);
  }
  const v = validateContact(raw as Record<string, unknown>);
  if ('error' in v) {
    return jsonResponse({ success: false, error: v.error }, 400, origin);
  }
  const contact = v;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!supabaseUrl || !serviceKey || !resendKey) {
    return jsonResponse({ success: false, error: 'server_misconfigured' }, 500, origin);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // Rate limits — hash before persisting.
  const ip = ipFromReq(req);
  const ipHash = await hmacSha256Hex(serviceKey, `contact:ip:${ip}`);
  const emailHash = await hmacSha256Hex(serviceKey, `contact:email:${contact.email}`);

  // Fail-closed: any limiter/storage error returns 503 BEFORE we touch Resend.
  const { data: emailRl, error: emailRlErr } = await supabase.rpc(
    'check_contact_submission_rate_limit',
    { p_identifier_hash: emailHash, p_scope: 'email', p_max_requests: 3, p_window_seconds: 3600 },
  );
  if (emailRlErr || !emailRl) {
    return jsonResponse({ success: false, error: 'rate_limit_unavailable' }, 503, origin);
  }
  if ((emailRl as any).allowed === false) {
    return jsonResponse({
      success: false, error: 'rate_limited',
      retry_after: Math.min(Number((emailRl as any).retry_after_seconds ?? 3600), 3600),
    }, 429, origin);
  }
  const { data: ipRl, error: ipRlErr } = await supabase.rpc(
    'check_contact_submission_rate_limit',
    { p_identifier_hash: ipHash, p_scope: 'ip', p_max_requests: 10, p_window_seconds: 3600 },
  );
  if (ipRlErr || !ipRl) {
    return jsonResponse({ success: false, error: 'rate_limit_unavailable' }, 503, origin);
  }
  if ((ipRl as any).allowed === false) {
    return jsonResponse({
      success: false, error: 'rate_limited',
      retry_after: Math.min(Number((ipRl as any).retry_after_seconds ?? 3600), 3600),
    }, 429, origin);
  }

  const confirmation = renderConfirmation(contact);
  const notification = renderAdminNotification(contact);

  const commonHeaders = {
    'Precedence': 'transactional',
  };

  // Send confirmation to the submitter. Idempotency key is stable per leg.
  const confirmRes = await sendResendEmail(
    {
      from: 'JoJo Prompts <info@jojoprompts.com>',
      to: contact.email,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
      reply_to: 'info@jojoprompts.com',
      headers: commonHeaders,
    },
    resendKey,
    resendIdempotencyKey('contact_confirmation', contact.submission_id),
  );

  await logMinimal(supabase, {
    email_address: contact.email,
    email_type: 'contact_confirmation',
    success: confirmRes.ok,
  });

  // Send admin notification. reply_to points to the submitter so support
  // can hit reply. Subject is server-fixed so header injection is impossible.
  const adminRes = await sendResendEmail(
    {
      from: 'JoJo Prompts <info@jojoprompts.com>',
      to: ADMIN_RECIPIENT,
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
      reply_to: contact.email,
      headers: commonHeaders,
    },
    resendKey,
    resendIdempotencyKey('contact_admin', contact.submission_id),
  );

  await logMinimal(supabase, {
    email_address: ADMIN_RECIPIENT,
    email_type: 'contact_admin_notification',
    success: adminRes.ok,
  });

  if (!adminRes.ok) {
    return jsonResponse({ success: false, error: 'delivery_failed' }, 502, origin);
  }

  return jsonResponse({
    success: true,
    confirmation_sent: confirmRes.ok,
  }, 200, origin);
}

async function logMinimal(supabase: any, r: {
  email_address: string; email_type: string; success: boolean;
}) {
  try {
    await supabase.from('email_logs').insert([{
      email_address: r.email_address,
      email_type: r.email_type,
      success: r.success,
      delivery_status: r.success ? 'sent' : 'failed',
      domain_type: 'other',
      retry_count: 0,
    }]);
  } catch { /* swallow */ }
}

if (import.meta.main) serve(handler);
