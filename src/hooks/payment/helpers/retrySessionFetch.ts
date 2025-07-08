
/**
 * Attempts to fetch Supabase session with retries for session recovery, returning session or null.
 */
import { supabase } from "@/integrations/supabase/client";

export async function retrySessionFetch(maxAttempts = 3, delayMs = 800) {
  let attempt = 1;
  while (attempt <= maxAttempts) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        return sessionData.session;
      }
    } catch (e) {
      // Log and ignore
      console.warn("Session fetch attempt failed", attempt, e);
    }
    await new Promise((res) => setTimeout(res, delayMs * attempt));
    attempt++;
  }
  return null;
}
