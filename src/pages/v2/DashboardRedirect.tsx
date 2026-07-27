import { Navigate, useLocation } from "react-router-dom";
import { resolveSafeNext } from "@/lib/v2/safeNext";

/**
 * Legacy `/dashboard` compatibility redirect. The V2 authenticated surface is
 * `/account`. Any legitimate `?next=` is preserved through the safe resolver;
 * everything else forwards to `/account`. Unauthenticated visitors land on
 * `/account`, which itself bounces them to `/login?next=/account`.
 */
export default function DashboardRedirect() {
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  const target = resolveSafeNext(sp.get("next"), "/account");
  return <Navigate to={target} replace />;
}
