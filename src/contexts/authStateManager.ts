
import { supabase } from "@/integrations/supabase/client";
import { fetchUserProfile } from "./profileService";

export function setupAuthState({ setSession, setUser, setUserRole, setLoading, setRecoveredOrphaned }: any) {
  let mounted = true;
  
  // Setup listener first
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, currentSession) => {
      if (!mounted) return;
      
      // Check if this is a password reset flow
      const urlParams = new URLSearchParams(window.location.search);
      const type = urlParams.get('type');
      const isPasswordReset = type === 'recovery';
      
      // If this is a password reset, don't auto-signin
      if (isPasswordReset && event === 'SIGNED_IN') {
        // Redirect to reset password page instead of auto-signin
        window.location.href = `/reset-password${window.location.search}`;
        return;
      }
      
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      
      if (currentUser && !isPasswordReset) {
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
