/**
 * Reversible Launch Lock — source of truth.
 *
 * When PUBLIC_LAUNCH_LOCK === true the site is globally locked. The ONLY
 * navigable, unlocked surface is Lovable's private preview host, which
 * matches the strict pattern `id-preview--<slug>.lovable.app`. Every other
 * host (production apex/www, the public Lovable subdomain
 * `jojoprompts.lovable.app`, any attacker-controlled subdomain, and all
 * non-browser/SSR contexts) MUST remain locked.
 *
 * To fully re-enable the public site, flip PUBLIC_LAUNCH_LOCK to `false`
 * and redeploy. Nothing else should be required to unlock.
 */
export const PUBLIC_LAUNCH_LOCK = true as const;

/**
 * Exact Lovable private preview host pattern. `id-preview--` prefix is
 * literal; slug is `[a-z0-9-]+`; suffix must be exactly `.lovable.app`.
 * Anchored on both ends so `id-preview--x.lovable.app.evil.com` and
 * `evil.id-preview--x.lovable.app` cannot match.
 */
const PREVIEW_HOST_RE = /^id-preview--[a-z0-9-]+\.lovable\.app$/i;

const DEV_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

/**
 * Pure helper — exported for tests. Accepts a hostname string (or
 * null/undefined for SSR) and returns whether that host is an unlocked
 * preview/dev surface. Fail-closed for anything that isn't recognized.
 */
export function isPreviewHost(hostname: string | null | undefined): boolean {
  if (typeof hostname !== "string" || hostname.length === 0) return false;
  const host = hostname.toLowerCase();
  if (PREVIEW_HOST_RE.test(host)) return true;
  if (DEV_HOSTS.has(host)) return true;
  return false;
}

export function isLaunchLocked(): boolean {
  if (PUBLIC_LAUNCH_LOCK !== true) return false;
  // SSR / non-browser: fail closed.
  if (typeof window === "undefined" || !window.location) return true;
  return !isPreviewHost(window.location.hostname);
}
