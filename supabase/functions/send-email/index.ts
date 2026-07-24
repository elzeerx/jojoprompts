// supabase/functions/send-email/index.ts
//
// Hardened variant. Behavior matrix by caller class:
//
//   service_role  (constant-time bearer match): full backward compat.
//                 May send raw subject/html/text, legacy `template`, and
//                 `template_slug` + `variables` to any recipient.
//   admin user    (verified JWT + has_role admin|jadmin): may send
//                 `template_slug` + `variables` to any valid recipient.
//                 Raw subject/html/text is REJECTED.
//   ordinary user (verified JWT): may send raw or template flows only
//                 when `to` case-insensitively equals the JWT's email,
//                 for a bounded set of lifecycle email_type values.
//   anonymous     : 401.
//
// Contact is no longer handled here; anonymous callers must use
// `submit-contact`. We keep verify_jwt=false in config so the internal
// service-role clients (`E1..E8`) can continue calling with the
// service-role bearer, but we enforce auth *inside* the handler.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { Resend } from 'npm:resend@2.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createEdgeLogger } from '../_shared/logger.ts';
import {
  ALLOWED_EMAIL_ORIGINS,
  corsHeadersFor,
  jsonResponse,
  methodGuardPost,
  readBoundedJson,
  hasOnlyAllowedKeys,
  constantTimeEqual,
  normalizeEmail,
} from '../_shared/emailCommon.ts';

// ---------------- Constants & limits

const MAX_SUBJECT = 200;
const MAX_HTML = 200_000;
const MAX_TEXT = 100_000;
const MAX_TEMPLATE_SLUG = 80;
const MAX_VARIABLES_JSON = 8_192;
const MAX_VARIABLES_KEYS = 20;

// Email types the *browser* is allowed to trigger.
const USER_ALLOWED_EMAIL_TYPES = new Set<string>([
  'welcome',
  'payment_confirmation',
  'payment_failed',
  'subscription_cancelled',
  'account_deleted',
  'email_confirmation',
  'password_reset',
]);

// Types that must NEVER be blocked by an unsubscribe entry.
// Marketing/lifecycle types outside this set (e.g. `welcome`) respect
// unsubscribe.
const TRANSACTIONAL_EMAIL_TYPES = new Set<string>([
  'email_confirmation',
  'password_reset',
  'payment_confirmation',
  'payment_failed',
  'account_deleted',
  'subscription_cancelled',
]);

// Legal top-level fields.
const ALLOWED_TOP_LEVEL_KEYS = [
  'to',
  'subject',
  'html',
  'text',
  'user_id',
  'email_type',
  'template',
  'data',
  'template_slug',
  'variables',
] as const;

// ---------------- Legacy template (kept for service-role callers)

const emailTemplates = {
  emailConfirmation: (data: { name: string; email: string; confirmationLink: string; email_type?: string }) => {
    const emailType = data.email_type || 'confirmation';
    const unsubscribeUrl = `https://jojoprompts.com/unsubscribe?email=${encodeURIComponent(data.email)}&type=${emailType}`;
    return {
      subject: "Your JoJo Prompts account confirmation",
      html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;">
<p>Hi ${data.name},</p>
<p>Please confirm your email to complete your account setup.</p>
<p><a href="${data.confirmationLink}">Confirm email</a></p>
<p><a href="${unsubscribeUrl}">Unsubscribe</a></p></body></html>`,
      text: `Hi ${data.name},\nConfirm your email: ${data.confirmationLink}\nUnsubscribe: ${unsubscribeUrl}`,
    };
  },
} as const;

// ---------------- Helpers

function getProp(obj: Record<string, any>, path: string) {
  return path.split('.').reduce(
    (acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined),
    obj,
  );
}
function interpolate(input: string, vars: Record<string, any>) {
  if (!input) return input;
  return input.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => {
    const val = getProp(vars, key);
    return val !== undefined && val !== null ? String(val) : '';
  });
}
function stripTags(html: string) { return html.replace(/<[^>]*>/g, ''); }
function buildTrackingPixel(email: string) {
  return `<img src="https://fxkqgjakbyrxkmevkglv.supabase.co/functions/v1/track-email-engagement?email=${encodeURIComponent(email || '')}" width="1" height="1" style="display:none;" alt="" />`;
}

// ---------------- Types

export type CallerClass =
  | { kind: 'service' }
  | { kind: 'admin'; userId: string; email: string }
  | { kind: 'user'; userId: string; email: string }
  | { kind: 'anonymous' };

import { validateTemplateSlug, validateVariables } from './validation.ts';


// ---------------- Handler

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  const guard = methodGuardPost(req);
  if (guard) return guard;

  const requestId = crypto.randomUUID();
  const logger = createEdgeLogger('send-email', requestId);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';

  if (!serviceKey || !supabaseUrl) {
    return jsonResponse({ success: false, error: 'server_misconfigured' }, 500, origin);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Parse body ONCE.
  const parsed = await readBoundedJson<Record<string, unknown>>(req);
  if (!parsed.ok) {
    return jsonResponse({ success: false, error: parsed.error }, parsed.status, origin);
  }
  const body = parsed.body ?? {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ success: false, error: 'invalid_body' }, 400, origin);
  }
  if (!hasOnlyAllowedKeys(body as Record<string, unknown>, ALLOWED_TOP_LEVEL_KEYS)) {
    return jsonResponse({ success: false, error: 'unknown_field' }, 400, origin);
  }

  // ---------- Auth classification
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let caller: CallerClass = { kind: 'anonymous' };

  if (bearer && serviceKey && constantTimeEqual(bearer, serviceKey)) {
    caller = { kind: 'service' };
  } else if (bearer) {
    const anon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: claimsData, error: claimsError } = await anon.auth.getClaims(bearer);
    const claims = claimsData?.claims as any;
    if (!claimsError && claims?.sub) {
      const userId = String(claims.sub);
      // Fail closed on canonical identity: never trust JWT email alone.
      const { data: userRow, error: userErr } = await supabase.auth.admin.getUserById(userId);
      if (userErr) {
        return jsonResponse({ success: false, error: 'identity_lookup_unavailable' }, 503, origin);
      }
      const canonicalEmail = normalizeEmail(userRow?.user?.email);
      if (!canonicalEmail) {
        return jsonResponse({ success: false, error: 'unauthorized' }, 401, origin);
      }
      // Role check via trusted RPC.
      let isAdmin = false;
      try {
        const { data: r1 } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
        const { data: r2 } = await supabase.rpc('has_role', { _user_id: userId, _role: 'jadmin' });
        isAdmin = Boolean(r1) || Boolean(r2);
      } catch { isAdmin = false; }
      caller = isAdmin
        ? { kind: 'admin', userId, email: canonicalEmail }
        : { kind: 'user',  userId, email: canonicalEmail };
    }
  }

  if (caller.kind === 'anonymous') {
    return jsonResponse({ success: false, error: 'unauthorized' }, 401, origin);
  }

  // ---------- Extract fields (typed shallow)
  const to = normalizeEmail((body as any).to);
  const subject = (body as any).subject;
  const html = (body as any).html;
  const text = (body as any).text;
  const email_type = typeof (body as any).email_type === 'string' ? (body as any).email_type : 'general';
  const template = (body as any).template;
  const data = (body as any).data;
  const template_slug = (body as any).template_slug;
  const variables = (body as any).variables;
  // Ignore client-provided user_id for non-service callers.
  const user_id = caller.kind === 'service' ? (body as any).user_id : (caller.kind === 'admin' || caller.kind === 'user' ? caller.userId : undefined);

  if (!to) {
    return jsonResponse({ success: false, error: 'invalid_recipient' }, 400, origin);
  }

  // Shared shape validation.
  if (subject !== undefined && (typeof subject !== 'string' || subject.length > MAX_SUBJECT)) {
    return jsonResponse({ success: false, error: 'invalid_subject' }, 400, origin);
  }
  if (html !== undefined && (typeof html !== 'string' || html.length > MAX_HTML)) {
    return jsonResponse({ success: false, error: 'invalid_html' }, 400, origin);
  }
  if (text !== undefined && (typeof text !== 'string' || text.length > MAX_TEXT)) {
    return jsonResponse({ success: false, error: 'invalid_text' }, 400, origin);
  }
  if (template_slug !== undefined && !validateTemplateSlug(template_slug)) {
    return jsonResponse({ success: false, error: 'invalid_template_slug' }, 400, origin);
  }
  if (variables !== undefined && !validateVariables(variables)) {
    return jsonResponse({ success: false, error: 'invalid_variables' }, 400, origin);
  }

  // ---------- Per-class authorization
  if (caller.kind === 'user') {
    // Locked recipient: user can only email themselves.
    if (to !== caller.email) {
      return jsonResponse({ success: false, error: 'recipient_locked_to_self' }, 403, origin);
    }
    // Allow only audited lifecycle types.
    if (!USER_ALLOWED_EMAIL_TYPES.has(email_type)) {
      return jsonResponse({ success: false, error: 'email_type_not_allowed' }, 400, origin);
    }
    // Bounded per-user rate limit via atomic service-only limiter — fail closed.
    const userHash = await hmacSha256Hex(serviceKey, `send-email:user:${caller.userId}`);
    const { data: rl, error: rlErr } = await supabase.rpc(
      'check_contact_submission_rate_limit',
      { p_identifier_hash: userHash, p_scope: 'user', p_max_requests: 10, p_window_seconds: 3600 },
    );
    if (rlErr || !rl) {
      return jsonResponse({ success: false, error: 'rate_limit_unavailable' }, 503, origin);
    }
    if ((rl as any).allowed === false) {
      return jsonResponse({ success: false, error: 'rate_limited' }, 429, origin);
    }
  } else if (caller.kind === 'admin') {
    // Admins may not submit raw subject/html/text.
    if (subject !== undefined || html !== undefined || text !== undefined || template !== undefined) {
      return jsonResponse({ success: false, error: 'admin_must_use_template_slug' }, 400, origin);
    }
    if (!template_slug) {
      return jsonResponse({ success: false, error: 'template_slug_required' }, 400, origin);
    }
    const adminHash = await hmacSha256Hex(serviceKey, `send-email:admin:${caller.userId}`);
    const { data: rl, error: rlErr } = await supabase.rpc(
      'check_contact_submission_rate_limit',
      { p_identifier_hash: adminHash, p_scope: 'admin', p_max_requests: 60, p_window_seconds: 3600 },
    );
    if (rlErr || !rl) {
      return jsonResponse({ success: false, error: 'rate_limit_unavailable' }, 503, origin);
    }
    if ((rl as any).allowed === false) {
      return jsonResponse({ success: false, error: 'rate_limited' }, 429, origin);
    }
  }
  // service: no per-caller rate limit; unrestricted.

  // ---------- Unsubscribe gate (marketing/lifecycle types only)
  if (!TRANSACTIONAL_EMAIL_TYPES.has(email_type)) {
    const { data: unsub } = await supabase
      .from('unsubscribed_emails')
      .select('email')
      .eq('email', to)
      .maybeSingle();
    if (unsub) {
      // Do NOT call Resend; return truthful non-success payload.
      await logEmail(supabase, {
        email_address: to,
        email_type,
        success: false,
        error_code: 'unsubscribed',
        user_id,
        delivery_status: 'blocked',
      });
      return jsonResponse({
        success: false,
        unsubscribed: true,
        delivery_status: 'blocked',
        error: 'unsubscribed',
      }, 200, origin);
    }
  }

  // ---------- Content resolution
  const vars: Record<string, any> = { ...(data || {}), ...(variables || {}) };
  vars.email = to;
  vars.unsubscribe_link = vars.unsubscribe_link
    || `https://jojoprompts.com/unsubscribe?email=${encodeURIComponent(to)}&type=${encodeURIComponent(email_type)}`;

  let finalSubject: string | undefined = subject;
  let finalHtml: string | undefined = html;
  let finalText: string | undefined = text;

  if (template_slug) {
    const { data: tmpl } = await supabase
      .from('email_templates')
      .select('subject, html, text, is_active')
      .eq('slug', template_slug)
      .eq('is_active', true)
      .maybeSingle();
    if (tmpl) {
      const htmlInterp = interpolate(tmpl.html, vars);
      finalSubject = interpolate(tmpl.subject, vars);
      finalHtml = htmlInterp + buildTrackingPixel(to);
      finalText = interpolate(tmpl.text || stripTags(htmlInterp), vars);
    } else {
      return jsonResponse({ success: false, error: 'template_not_found' }, 400, origin);
    }
  } else if (template && caller.kind === 'service') {
    // Legacy in-file templates: service-role only.
    const fn = (emailTemplates as any)[template];
    if (typeof fn === 'function') {
      const r = fn({ ...(vars || {}), email_type });
      finalSubject = r.subject;
      finalHtml = r.html;
      finalText = r.text || stripTags(r.html);
    } else {
      return jsonResponse({ success: false, error: 'template_not_found' }, 400, origin);
    }
  }

  if (!finalSubject || !finalHtml) {
    return jsonResponse({ success: false, error: 'missing_content' }, 400, origin);
  }

  // ---------- Send via Resend
  if (!resendApiKey) {
    return jsonResponse({ success: false, error: 'server_misconfigured' }, 500, origin);
  }

  const resend = new Resend(resendApiKey);
  let messageId: string | null = null;
  try {
    const result = await resend.emails.send({
      from: 'JoJo Prompts <info@jojoprompts.com>',
      to,
      subject: finalSubject,
      html: finalHtml,
      text: finalText || stripTags(finalHtml),
      headers: {
        'Reply-To': 'info@jojoprompts.com',
        'List-Unsubscribe': `<${vars.unsubscribe_link}>, <mailto:unsubscribe@jojoprompts.com>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'Precedence': TRANSACTIONAL_EMAIL_TYPES.has(email_type) ? 'transactional' : 'bulk',
      },
    });
    if ((result as any).error) {
      logger.error('resend_send_failed');
      await logEmail(supabase, {
        email_address: to,
        email_type,
        success: false,
        error_code: 'provider_error',
        user_id,
        delivery_status: 'failed',
      });
      return jsonResponse({ success: false, error: 'provider_error' }, 502, origin);
    }
    messageId = (result as any).data?.id || (result as any).id || null;
  } catch (_err) {
    logger.error('resend_send_exception');
    await logEmail(supabase, {
      email_address: to,
      email_type,
      success: false,
      error_code: 'provider_exception',
      user_id,
      delivery_status: 'failed',
    });
    return jsonResponse({ success: false, error: 'provider_exception' }, 502, origin);
  }

  await logEmail(supabase, {
    email_address: to,
    email_type,
    success: true,
    user_id,
    delivery_status: 'sent',
  });

  return jsonResponse({ success: true, messageId }, 200, origin);
}

async function logEmail(supabase: any, r: {
  email_address: string;
  email_type: string;
  success: boolean;
  user_id?: string;
  error_code?: string;
  delivery_status: string;
}) {
  try {
    await supabase.from('email_logs').insert([{
      email_address: r.email_address,
      email_type: r.email_type,
      success: r.success,
      error_message: r.error_code ?? null,
      user_id: r.user_id ?? null,
      domain_type: 'other',
      retry_count: 0,
      delivery_status: r.delivery_status,
    }]);
  } catch { /* swallow */ }
}

// Only start the server if this module is the entry point. Test files import
// the handler directly and must not spin up an HTTP listener.
if (import.meta.main) serve(handler);


// Re-exports for tests.
export { ALLOWED_EMAIL_ORIGINS, corsHeadersFor };
