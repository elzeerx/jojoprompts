import { Loader2 } from "lucide-react";
import HomePage from "./HomePage";
import { useAuth } from "@/contexts/AuthContext";
import { createLogger } from "@/utils/logging";

const logger = createLogger("INDEX_PAGE");

/**
 * Root ("/") is the V2 public homepage for every visitor, including
 * signed-in admins. Admins reach their console from the account menu
 * (see V2Header) — we no longer redirect them away from the marketing
 * surface.
 */
export default function Index() {
  let loading = false;
  try {
    loading = useAuth().loading;
  } catch (error) {
    logger.warn("Auth context unavailable at Index", { error });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <HomePage />;
}
