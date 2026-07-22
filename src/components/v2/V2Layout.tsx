import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { V2SubNav } from "./V2SubNav";

/**
 * Shared layout for V2 public routes (explore, categories, resource detail, library).
 * Reserves space for the fixed global Header (h-16 mobile, h-18 lg) so the sticky
 * V2SubNav's in-flow and sticky positions agree and content never hides behind chrome.
 */
export function V2Layout() {
  const { user } = useAuth();
  return (
    <div className="pt-16 lg:pt-18">
      <V2SubNav authed={!!user} />
      <Outlet />
    </div>
  );
}
