import { Navigate, useLocation } from "react-router-dom";
import NotFoundPage from "@/pages/NotFoundPage";

/**
 * Old public URLs stay valid without each appearing as a separate Lovable
 * page. Destinations are fixed; arbitrary incoming parameters are discarded
 * except for the historic prompts-catalog filter URL.
 */
const LEGACY_PUBLIC_PATHS: Readonly<Record<string, string>> = {
  "/skills": "/explore?type=skill",
  "/automations": "/explore?type=automation",
  "/prompts": "/explore?type=prompt",
  "/image-styles": "/explore?type=image_style",
  "/bundles": "/explore?type=bundle",
  "/prompts/chatgpt": "/explore?type=prompt&p=chatgpt",
  "/prompts/midjourney": "/explore?type=image_style",
  "/prompts/workflow": "/explore?type=automation",
  "/prompts/gpts-builder": "/explore?type=skill",
  "/favorites": "/library",
  "/payment-dashboard": "/orders",
  "/dashboard": "/account",
  "/dashboard/subscription": "/account",
  "/payment-success": "/orders",
  "/payment-failed": "/orders",
  "/payment-recovery": "/orders",
  "/dashboard/prompter": "/explore",
  "/prompter": "/explore",
  "/examples": "/explore",
  "/search": "/explore",
  "/demo/enhanced-prompt": "/explore",
};

export function PublicRouteResolver() {
  const { pathname, search, hash } = useLocation();

  if (pathname === "/prompts-catalog") {
    const params = new URLSearchParams(search);
    const next = new URLSearchParams();
    const query = params.get("query") ?? params.get("q");
    const platform = params.get("platform") ?? params.get("p");
    if (query) next.set("q", query);
    if (platform) next.set("p", platform);
    next.set("type", "prompt");
    return <Navigate to={`/explore?${next.toString()}${hash}`} replace />;
  }

  const destination = LEGACY_PUBLIC_PATHS[pathname];
  return destination ? <Navigate to={destination} replace /> : <NotFoundPage />;
}
