
import { supabase } from "@/integrations/supabase/client";
import { fetchUserProfile } from "./profileService";

export function setupAuthState({ setSession, setUser, setUserRole, setLoading, setRecoveredOrphaned, isLoggingOut }: any) {
  let mounted = true;
  
  // Setup listener first
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, currentSession) => {
      if (!mounted) return;
      
      // If we're in the middle of logging out, ignore auth state changes
      // This prevents the listener from restoring session during logout
      if (isLoggingOut && isLoggingOut()) {
        console.log("[AUTH] Ignoring auth state change during logout:", event);
        return;
      }
      
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

      console.log("[AUTH] Auth state change:", event, { sessionExists: !!currentSession, userEmail: currentSession?.user?.email });
      
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      
      if (currentUser && !isPasswordReset) {
        setTimeout(() => {
          if (mounted && !isLoggingOut()) {
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
