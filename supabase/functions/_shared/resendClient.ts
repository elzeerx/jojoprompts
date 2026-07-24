// Direct Resend REST helper used by submit-contact and send-email.
//
// We deliberately do NOT use the `npm:resend@2.0.0` SDK's optional second
// argument for idempotency, because that version predates the SDK feature.
// This helper sets the real HTTP `Idempotency-Key` header, which Resend
// honours on `POST /emails` to deduplicate identical retries.

export interface ResendSendPayload {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string | string[];
  headers?: Record<string, string>;
}

export interface ResendSendResult {
  ok: boolean;
  status: number;
  id: string | null;
  errorCode?: string; // sanitized, never the raw provider message
}

// Stable idempotency key per (leg, submission id). Different legs
// (confirmation vs admin) MUST produce different keys so provider dedup
// does not swallow the second send.
export function resendIdempotencyKey(
  leg: 'contact_confirmation' | 'contact_admin' | 'send_email',
  stableId: string,
): string {
  // Resend caps idempotency keys at 256 chars; ours are well under.
  return `${leg}:${stableId}`;
}

export async function sendResendEmail(
  payload: ResendSendPayload,
  apiKey: string,
  idempotencyKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResendSendResult> {
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    let body: any = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok) {
      return { ok: false, status: res.status, id: null, errorCode: 'provider_error' };
    }
    return { ok: true, status: res.status, id: (body && body.id) || null };
  } catch {
    return { ok: false, status: 0, id: null, errorCode: 'provider_exception' };
  }
}
