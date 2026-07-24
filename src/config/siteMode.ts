/**
 * Reversible Launch Lock — source of truth.
 *
 * When PUBLIC_LAUNCH_LOCK === true:
 *   • Every public and customer-facing route renders the Coming Soon page.
 *   • All signup UI (email/password + Google) is removed from the login form.
 *   • The `/signup` route resolves to Coming Soon.
 *   • Only `/admin/**` (server-backed AdminGuard) and `/login`
 *     (admin-login-only mode) remain reachable.
 *
 * To fully re-enable the public site, flip this single constant to `false`
 * and redeploy. Nothing else should be required to unlock.
 */
export const PUBLIC_LAUNCH_LOCK = true as const;

export function isLaunchLocked(): boolean {
  return PUBLIC_LAUNCH_LOCK === true;
}
