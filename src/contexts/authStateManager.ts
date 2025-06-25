
import { supabase } from "@/integrations/supabase/client";
import { fetchUserProfile } from "./profileService";

export function setupAuthState({ setSession, setUser, setUserRole, setLoading, setRecoveredOrphaned }: any) {
  let mounted = true;
  // Setup listener first
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setTimeout(() => {
          if (mounted) {
            fetchUserProfile(currentUser, setUserRole).finally(() => {
              if (mounted) setLoading(false);
            });
            // Orphaned payment logic injected by orphanedPaymentRecovery.ts
          }
        }, 0);
      } else {
        setUserRole(null);
        if (mounted) setLoading(false);
      }
    }
  );
  // Return unmount cleanup
  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}
