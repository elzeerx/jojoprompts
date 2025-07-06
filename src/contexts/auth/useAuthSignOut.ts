import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { SessionManager } from '@/hooks/payment/helpers/sessionManager';
import { SessionSecurity } from '@/utils/sessionSecurity';
import { logger } from '@/utils/productionLogger';
import { debug } from '../authDebugger';
import { supabase } from '@/integrations/supabase/client';

interface UseAuthSignOutProps {
  setIsLoggingOut: (value: boolean) => void;
  setSession: (session: any) => void;
  setUser: (user: any) => void;
  setUserRole: (role: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthSignOut = ({
  setIsLoggingOut,
  setSession,
  setUser,
  setUserRole,
  setLoading
}: UseAuthSignOutProps) => {
  const navigate = useNavigate();

  const signOut = useCallback(async () => {
    try {
      debug("Starting logout process");
      setIsLoggingOut(true);

      // First, validate current session
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        logger.warn("Session validation error during logout", { error: sessionError.message });
        // Continue with logout anyway
      }

      if (!currentSession) {
        debug("No active session found, clearing local state only");
        // Clean up local state even if no server session
        SessionManager.cleanup();
        setSession(null);
        setUser(null);
        setUserRole(null);
        navigate('/login');
        
        toast({
          title: "Logged out",
          description: "You have been successfully logged out.",
        });
        return;
      }

      debug("Valid session found, proceeding with server logout", { userId: currentSession.user?.id });

      // Attempt server logout with timeout
      const logoutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Logout timeout')), 10000)
      );

      let logoutError = null;
      try {
        const { error } = await Promise.race([logoutPromise, timeoutPromise]) as any;
        logoutError = error;
      } catch (timeoutError) {
        logger.error("Logout timeout", { error: timeoutError });
        logoutError = timeoutError;
      }

      if (logoutError) {
        logger.error("Server logout error", { error: logoutError.message });
        
        // Check if it's a connection issue vs auth issue
        if (logoutError.message?.includes('connection') || logoutError.message?.includes('network')) {
          // For connection issues, force local logout
          debug("Connection issue detected, forcing local logout");
        } else if (logoutError.message?.includes('session_not_found')) {
          // Session already invalid on server, proceed with local cleanup
          debug("Session not found on server, proceeding with local cleanup");
        } else {
          // Other errors - still try to clean up locally but show error
          logger.error("Unexpected logout error", { error: logoutError.message });
          toast({
            title: "Logout Issue",
            description: "There was an issue signing out completely. Please try again if needed.",
            variant: "destructive"
          });
        }
      } else {
        debug("Server logout successful");
      }

      // Always clean up local state after server logout attempt
      SessionManager.cleanup();
      SessionSecurity.cleanup();
      
      // Clear any additional auth-related localStorage items
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('auth') || key.includes('session')) {
          localStorage.removeItem(key);
        }
      });

      // Clear local state
      setSession(null);
      setUser(null);
      setUserRole(null);
      
      debug("Local state cleared, navigating to login");
      navigate('/login');
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });

    } catch (error) {
      logger.error("Unexpected sign out error", { error });
      
      // Even on unexpected errors, try to clean up
      SessionManager.cleanup();
      SessionSecurity.cleanup();
      setSession(null);
      setUser(null);
      setUserRole(null);
      navigate('/login');
      
      toast({
        title: "Logout Completed",
        description: "You have been logged out. Please sign in again if needed.",
      });
    } finally {
      setIsLoggingOut(false);
      setLoading(false);
    }
  }, [navigate, setIsLoggingOut, setSession, setUser, setUserRole, setLoading]);

  return signOut;
};
