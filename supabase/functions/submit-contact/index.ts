// supabase/functions/submit-contact/index.ts
//
// Public contact-form endpoint. Server owns recipients, subjects, HTML,
// and text — the browser cannot inject any of them. Anonymous by design,
// so it enforces its own rate limits (per hashed IP and hashed email)
// and never persists raw identifiers or the contact message.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { Resend } from 'npm:resend@2.0.0';
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

const ADMIN_RECIPIENT = 'info@jojoprompts.com';

export { validateContact, validateSubmissionId, corsHeadersFor };



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
  const text = `Thanks, ${p.name}\n\nWe received your message about "${p.subject}" and will reply within 24 hours.\n\nIf you did not submit this form, you can ignore this email.\n\n— The JoJo Prompts team`;
  return { subject, html, text };
}

function renderAdminNotification(p: ParsedContact) {
  const subject = `New contact form submission from ${p.name}`;
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

  const { data: emailRl } = await supabase.rpc('check_contact_submission_rate_limit', {
    p_identifier_hash: emailHash, p_scope: 'email',
    p_max_requests: 3, p_window_seconds: 3600,
  });
  if (emailRl && (emailRl as any).allowed === false) {
    return jsonResponse({
      success: false, error: 'rate_limited',
      retry_after: Math.min(Number((emailRl as any).retry_after_seconds ?? 3600), 3600),
    }, 429, origin);
  }
  const { data: ipRl } = await supabase.rpc('check_contact_submission_rate_limit', {
    p_identifier_hash: ipHash, p_scope: 'ip',
    p_max_requests: 10, p_window_seconds: 3600,
  });
  if (ipRl && (ipRl as any).allowed === false) {
    return jsonResponse({
      success: false, error: 'rate_limited',
      retry_after: Math.min(Number((ipRl as any).retry_after_seconds ?? 3600), 3600),
    }, 429, origin);
  }

  const resend = new Resend(resendKey);
  const confirmation = renderConfirmation(contact);
  const notification = renderAdminNotification(contact);

  const commonHeaders = {
    'Reply-To': 'info@jojoprompts.com',
    'Precedence': 'transactional',
  };

  // Send confirmation (to submitter).
  let confirmationOk = false;
  try {
    const r = await resend.emails.send({
      from: 'JoJo Prompts <info@jojoprompts.com>',
      to: contact.email,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
      headers: {
        ...commonHeaders,
        'X-Entity-Ref-ID': `contact-confirmation:${contact.submission_id}`,
      },
    });
    confirmationOk = !(r as any).error;
  } catch { confirmationOk = false; }

  await logMinimal(supabase, {
    email_address: contact.email,
    email_type: 'contact_confirmation',
    success: confirmationOk,
  });

  // Send admin notification. Failure of the admin copy is a hard failure —
  // we surface it so the caller knows the message wasn't received internally.
  let adminOk = false;
  try {
    const r = await resend.emails.send({
      from: 'JoJo Prompts <info@jojoprompts.com>',
      to: ADMIN_RECIPIENT,
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
      reply_to: contact.email,
      headers: {
        ...commonHeaders,
        'X-Entity-Ref-ID': `contact-admin:${contact.submission_id}`,
      },
    });
    adminOk = !(r as any).error;
  } catch { adminOk = false; }

  await logMinimal(supabase, {
    email_address: ADMIN_RECIPIENT,
    email_type: 'contact_admin_notification',
    success: adminOk,
  });

  if (!adminOk) {
    return jsonResponse({ success: false, error: 'delivery_failed' }, 502, origin);
  }

  return jsonResponse({
    success: true,
    confirmation_sent: confirmationOk,
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

export { corsHeadersFor };
