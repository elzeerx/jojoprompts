// Pure decision helper for the send-email unsubscribe gate. No I/O.
// Kept in a dependency-free module so unit tests can import it without
// pulling npm dependencies (e.g. resend) from the main handler.

export const TRANSACTIONAL_EMAIL_TYPES = new Set<string>([
  'email_confirmation',
  'password_reset',
  'payment_confirmation',
  'payment_failed',
  'account_deleted',
  'subscription_cancelled',
]);

export type UnsubscribeDecision = 'bypass' | 'error_503' | 'blocked' | 'proceed';

export function decideUnsubscribeAction(
  emailType: string,
  lookup: { hasError: boolean; hasRow: boolean },
): UnsubscribeDecision {
  if (TRANSACTIONAL_EMAIL_TYPES.has(emailType)) return 'bypass';
  if (lookup.hasError) return 'error_503';
  if (lookup.hasRow) return 'blocked';
  return 'proceed';
}
