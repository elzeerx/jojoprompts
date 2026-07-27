/**
 * V2 release-hardening: the legacy `recover-orphaned-payments` Edge Function
 * is retired. This module is kept as a no-op so existing call sites compile
 * and the auth initializer can be simplified over time. It performs NO
 * network I/O and always marks recovery as attempted.
 */
export async function runOrphanedPaymentRecovery(
  _currentUser: unknown,
  _recoveredOrphaned: boolean,
  setRecoveredOrphaned: (val: boolean) => void,
): Promise<void> {
  // Idempotent: mark done without hitting the retired endpoint.
  setRecoveredOrphaned(true);
}
