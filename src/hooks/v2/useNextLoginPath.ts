import { useLocation } from "react-router-dom";

/**
 * Build a safe login link that preserves the exact pathname+search via the
 * existing `?next=` mechanism honored by `LoginForm`. Never uses `?redirect=`
 * and never emits protocol-relative paths.
 */
export function useNextLoginPath(): string {
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return `/login?next=${encodeURIComponent(safe)}`;
}
