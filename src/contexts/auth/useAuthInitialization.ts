import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { fetchUserProfile } from '../profileService';
// V2 release-hardening: `runOrphanedPaymentRecovery` is retired
// (see src/contexts/orphanedPaymentRecovery.ts). No import needed.
import { debug } from '../authDebugger';
import { SessionManager } from '@/hooks/payment/helpers/sessionManager';
import { SessionSecurity } from '@/utils/sessionSecurity';
import { logger } from '@/utils/productionLogger';
import { supabase } from '@/integrations/supabase/client';
import { checkPasswordReset, checkSignupConfirmation, checkPaymentCallback } from './authHelpers';
import { resolveSafeNext, DEFAULT_SAFE_NEXT } from '@/lib/v2/safeNext';

interface UseAuthInitializationProps {
  setSession: (session: any) => void;
  setUser: (user: any) => void;
  setUserRole: (role: string | null) => void;
  setLoading: (loading: boolean) => void;
  recoveredOrphaned: boolean;
  setRecoveredOrphaned: (value: boolean) => void;
  isLoggingOut: () => boolean;
}

export const useAuthInitialization = ({
  setSession,
  setUser,
  setUserRole,
  setLoading,
  recoveredOrphaned,
  setRecoveredOrphaned,
  isLoggingOut
}: UseAuthInitializationProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const initializeAuth = async () => {
      // If this is a password reset, don't set session
      if (checkPasswordReset(location.search)) {
        debug("Password reset detected, not setting session");
        setLoading(false);
        return;
      }

      // Enhanced session restoration for payment callbacks
      if (checkPaymentCallback(location.pathname, location.search) && SessionManager.hasBackup()) {
        debug("Payment callback detected with session backup, attempting restoration");
        
        const restorationResult = await SessionManager.restoreSession();
        if (restorationResult.success && restorationResult.user) {
          debug("Session successfully restored from backup", { userId: restorationResult.user.id });
          
          setSession({ user: restorationResult.user });
          setUser(restorationResult.user);
          
          await fetchUserProfile(restorationResult.user, setUserRole);
          setLoading(false);
          
          // V2: orphaned payment recovery via legacy endpoint is retired.
          setRecoveredOrphaned(true);
          return;
        } else {
          debug("Session restoration failed, falling back to normal auth check");
        }
      }

      // Normal session check
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error("Error getting initial session", { error: error.message });
          setLoading(false);
          return;
        }
        
        debug("Initial session check", { sessionExists: !!initialSession, userEmail: initialSession?.user?.email });
        
        setSession(initialSession);
        const initialUser = initialSession?.user ?? null;
        setUser(initialUser);
        
        if (initialUser) {
          await fetchUserProfile(initialUser, setUserRole);
          
          // Handle signup confirmation redirect
          if (checkSignupConfirmation(location.search)) {
            const params = new URLSearchParams(location.search);
            const safeNext = resolveSafeNext(params.get('next'));
            debug("Signup confirmation detected", { currentPath: location.pathname, search: location.search, safeNext });

            // Send welcome email for newly confirmed users
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name')
              .eq('id', initialUser.id)
              .single();

            if (profile?.first_name && initialUser.email) {
              const { emailService } = await import('@/utils/emailService');
              setTimeout(async () => {
                await emailService.sendWelcomeEmail(profile.first_name, initialUser.email!);
              }, 1000);
            }

            // V2: one-time ownership model — no subscription language, no plan
            // gating. Confirmed users go to their safe `next` or /explore.
            toast({
              title: "Welcome! 🎉",
              description: "Your email is confirmed. You permanently own what you buy — no subscriptions.",
            });

            navigate(safeNext || DEFAULT_SAFE_NEXT);
          }

          // V2: orphaned payment recovery via legacy endpoint is retired.
          setRecoveredOrphaned(true);
        }
        
        setLoading(false);
        
        // Initialize session security
        SessionSecurity.initialize();
      } catch (error) {
        logger.error("Session initialization error", { error });
        setLoading(false);
      }
    };

    // Initialize auth
    initializeAuth();
  }, [location.search, location.pathname, navigate, setSession, setUser, setUserRole, setLoading, recoveredOrphaned, setRecoveredOrphaned]);
};