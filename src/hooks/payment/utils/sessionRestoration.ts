
import { supabase } from "@/integrations/supabase/client";

/**
 * Attempts to restore Supabase auth session, including localStorage backup
 */
export async function attemptSessionRestoration(currentUser: any, authRestorationAttempts: number, MAX_AUTH_ATTEMPTS: number, setCurrentUser: (u: any) => void, transactionUserId?: string) {
  if (currentUser || authRestorationAttempts >= MAX_AUTH_ATTEMPTS) {
    return false;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (session?.user) {
    setCurrentUser(session.user);
    return true;
  }

  const backupRaw = localStorage.getItem('payPalSessionBackup');
  if (backupRaw) {
    try {
      const tokens = JSON.parse(backupRaw);
      if (tokens?.access_token && tokens?.refresh_token) {
        const { data: restored, error: restoreError } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token
        });
        if (!restoreError && restored.session?.user) {
          setCurrentUser(restored.session.user);
          localStorage.removeItem('payPalSessionBackup');
          return true;
        }
      }
    } catch {
      localStorage.removeItem('payPalSessionBackup');
    }
  }

  if (transactionUserId) {
    return true;
  }
  return false;
}
