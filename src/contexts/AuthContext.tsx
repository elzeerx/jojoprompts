import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { AuthContextType } from './authTypes';
import { fetchUserProfile } from './profileService';
import { setupAuthState } from './authStateManager';
import { runOrphanedPaymentRecovery } from './orphanedPaymentRecovery';
import { computeRolePermissions } from './rolePermissions';
import { debug } from './authDebugger';
import { SessionManager } from '@/hooks/payment/helpers/sessionManager';
import { useWelcomeEmail } from '@/hooks/useWelcomeEmail';
import { supabase } from '@/integrations/supabase/client';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [recoveredOrphaned, setRecoveredOrphaned] = useState(false);
  const { sendWelcomeEmail } = useWelcomeEmail();

  // Check if this is a password reset request
  const isPasswordReset = () => {
    try {
      const urlParams = new URLSearchParams(location.search);
      const type = urlParams.get('type');
      const token = urlParams.get('access_token') || urlParams.get('token');
      return type === 'recovery' && token;
    } catch (error) {
      console.error('Error checking password reset params:', error);
      return false;
    }
  };

  // Check if this is coming from signup email confirmation
  const isFromSignupConfirmation = () => {
    try {
      const urlParams = new URLSearchParams(location.search);
      return urlParams.get('from_signup') === 'true';
    } catch (error) {
      console.error('Error checking signup confirmation params:', error);
      return false;
    }
  };

  // Check if this is a payment callback
  const isPaymentCallback = () => {
    try {
      return location.pathname.includes('/payment') || 
             location.search.includes('success=') ||
             location.search.includes('payment_id=') ||
             location.search.includes('order_id=');
    } catch (error) {
      console.error('Error checking payment callback:', error);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        setAuthError(null);
        
        // If this is a password reset, don't set session
        if (isPasswordReset()) {
          debug("Password reset detected, not setting session");
          if (mounted) setLoading(false);
          return;
        }

        // Enhanced session restoration for payment callbacks
        if (isPaymentCallback() && SessionManager.hasBackup()) {
          debug("Payment callback detected with session backup, attempting restoration");
          
          try {
            const restorationResult = await SessionManager.restoreSession();
            if (restorationResult.success && restorationResult.user) {
              debug("Session successfully restored from backup", { userId: restorationResult.user.id });
              
              if (mounted) {
                setSession({ user: restorationResult.user });
                setUser(restorationResult.user);
                
                await fetchUserProfile(restorationResult.user, setUserRole);
                setLoading(false);
                
                // Run orphan recovery for restored session
                runOrphanedPaymentRecovery(restorationResult.user, recoveredOrphaned, setRecoveredOrphaned);
              }
              return;
            } else {
              debug("Session restoration failed, falling back to normal auth check");
            }
          } catch (restoreError) {
            console.error("Session restoration error:", restoreError);
            debug("Session restoration failed, falling back to normal auth check");
          }
        }

        // Normal session check with timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Session check timeout')), 10000);
        });

        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
        
        if (timeoutId) clearTimeout(timeoutId);
        
        const { data: { session: initialSession }, error } = result;
        
        if (error) {
          console.error("[AUTH] Error getting initial session:", error);
          setAuthError("Failed to initialize authentication");
          if (mounted) setLoading(false);
          return;
        }
        
        debug("Initial session check", { sessionExists: !!initialSession, userEmail: initialSession?.user?.email });
        
        if (mounted) {
          setSession(initialSession);
          const initialUser = initialSession?.user ?? null;
          setUser(initialUser);
          
          if (initialUser) {
            try {
              await fetchUserProfile(initialUser, setUserRole);
              
              // Handle signup confirmation redirect and send welcome email
              if (isFromSignupConfirmation()) {
                const urlParams = new URLSearchParams(location.search);
                const planId = urlParams.get('plan_id');
                
                // Send welcome email on email confirmation
                try {
                  const userName = initialUser.user_metadata?.first_name 
                    ? `${initialUser.user_metadata.first_name} ${initialUser.user_metadata.last_name || ''}`.trim()
                    : initialUser.email.split('@')[0];
                  
                  console.log("Sending welcome email on email confirmation to:", initialUser.email);
                  const emailResult = await sendWelcomeEmail(userName, initialUser.email);
                  
                  if (emailResult.success) {
                    console.log("Welcome email sent successfully on confirmation");
                  } else {
                    console.warn("Welcome email failed on confirmation:", emailResult.error);
                  }
                } catch (emailError) {
                  console.error("Welcome email error on confirmation:", emailError);
                }
                
                toast({
                  title: "Welcome! 🎉",
                  description: planId 
                    ? "Your email is confirmed! Complete your subscription below."
                    : "Your email is confirmed! Welcome to JoJo Prompts.",
                });

                if (!planId && location.pathname !== '/prompts') {
                  navigate('/prompts');
                }
              }

              // Run orphan recovery
              runOrphanedPaymentRecovery(initialUser, recoveredOrphaned, setRecoveredOrphaned);
            } catch (profileError) {
              console.error("Profile fetch error:", profileError);
              // Continue without profile data
            }
          }
          
          setLoading(false);
        }
      } catch (error) {
        console.error("[AUTH] Session initialization error:", error);
        if (mounted) {
          setAuthError("Failed to initialize authentication");
          setLoading(false);
        }
      }
    };

    // Setup auth state changes with error handling
    let cleanup: (() => void) | undefined;
    
    try {
      cleanup = setupAuthState({ 
        setSession, 
        setUser, 
        setUserRole, 
        setLoading, 
        setRecoveredOrphaned,
        isLoggingOut: () => isLoggingOut
      });
    } catch (error) {
      console.error("[AUTH] Failed to setup auth state listener:", error);
      setAuthError("Failed to setup authentication listener");
    }
    
    // Initialize auth
    initializeAuth();
    
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (cleanup) cleanup();
    };
  }, [location.search, location.pathname, navigate, isLoggingOut, sendWelcomeEmail]);

  const signOut = async () => {
    try {
      debug("Starting logout process");
      setIsLoggingOut(true);
      setAuthError(null);

      // First, validate current session
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn("[AUTH] Session validation error during logout:", sessionError);
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
        console.error("[AUTH] Logout timeout:", timeoutError);
        logoutError = timeoutError;
      }

      if (logoutError) {
        console.error("[AUTH] Server logout error:", logoutError);
        
        // Check if it's a connection issue vs auth issue
        if (logoutError.message?.includes('connection') || logoutError.message?.includes('network')) {
          // For connection issues, force local logout
          debug("Connection issue detected, forcing local logout");
        } else if (logoutError.message?.includes('session_not_found')) {
          // Session already invalid on server, proceed with local cleanup
          debug("Session not found on server, proceeding with local cleanup");
        } else {
          // Other errors - still try to clean up locally but show error
          console.error("[AUTH] Unexpected logout error:", logoutError);
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
      
      // Clear any additional auth-related localStorage items
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('session')) {
            localStorage.removeItem(key);
          }
        });
      } catch (storageError) {
        console.warn("Error clearing localStorage:", storageError);
      }

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
      console.error("[AUTH] Unexpected sign out error:", error);
      
      // Even on unexpected errors, try to clean up
      SessionManager.cleanup();
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
  };

  // Role/permission calculation
  const permissions = computeRolePermissions(userRole);

  const contextValue = {
    session,
    user,
    userRole,
    ...permissions,
    loading,
    signOut
  };

  debug("Auth context render", { ...contextValue, isLoggingOut, authError });

  // If there's an auth error, show fallback UI
  if (authError && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">JoJo Prompts</h1>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Authentication service is temporarily unavailable. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
