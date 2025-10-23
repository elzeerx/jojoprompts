import { supabase } from "@/integrations/supabase/client";
import { fetchUserProfile } from "./profileService";
import { createLogger } from '@/utils/logging';

const logger = createLogger('AUTH_STATE');

export function setupAuthState({ setSession, setUser, setUserRole, setLoading, setRecoveredOrphaned, isLoggingOut }: any) {
  let mounted = true;
  
  // Setup listener first
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, currentSession) => {
      if (!mounted) return;
      
      // If we're in the middle of logging out, ignore auth state changes
      // This prevents the listener from restoring session during logout
      if (isLoggingOut && isLoggingOut()) {
        logger.debug('Ignoring auth state change during logout', { event });
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

      logger.info('Auth state change', { 
        event, 
        sessionExists: !!currentSession, 
        userEmail: currentSession?.user?.email 
      });
      
      // Handle token refresh errors more gracefully
      if (event === 'TOKEN_REFRESHED') {
        logger.debug('Token refreshed successfully');
      } else if (event === 'SIGNED_OUT' && !currentSession) {
        logger.info('User signed out or session expired');
        setSession(null);
        setUser(null);
        setUserRole(null);
        if (mounted) setLoading(false);
        return;
      }
      
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
