import { Navigate, useLocation } from "react-router-dom";
import NotFoundPage from "@/pages/NotFoundPage";
import { resolveLegacyPublicPath } from "@/components/v2/publicRouteCompatibility";

export function PublicRouteResolver() {
  const { pathname, search, hash } = useLocation();
  const destination = resolveLegacyPublicPath(pathname, search, hash);
  return destination ? <Navigate to={destination} replace /> : <NotFoundPage />;
}
