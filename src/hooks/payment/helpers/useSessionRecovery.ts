
import { supabase } from "@/integrations/supabase/client";
import { retrySessionFetch } from "./retrySessionFetch";

/**
 * Attempts to recover the active user session.
 * Returns { user, session } if available, or null if not recoverable.
 */
export async function recoverSession(initialUser: any) {
  let activeUser = initialUser;
  let sessionData;

  try {
    sessionData = await supabase.auth.getSession();
    if (sessionData.data?.session?.user) {
      activeUser = sessionData.data.session.user;
    }
    if (!activeUser) {
      const recovered = await retrySessionFetch();
      if (recovered?.user) {
        activeUser = recovered.user;
      }
    }
  } catch (error) {
    // Could log this if needed
  }

  return { user: activeUser, session: sessionData?.data?.session || null };
}
