
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
import { supabase } from '@/integrations/supabase/client';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [recoveredOrphaned, setRecoveredOrphaned] = useState(false);

  // Check if this is a password reset request
  const isPasswordReset = () => {
    const urlParams = new URLSearchParams(location.search);
    const type = urlParams.get('type');
    const token = urlParams.get('access_token') || urlParams.get('token');
    return type === 'recovery' && token;
  };

  // Check if this is coming from signup email confirmation
  const isFromSignupConfirmation = () => {
    const urlParams = new URLSearchParams(location.search);
    return urlParams.get('from_signup') === 'true';
  };

  // Check if this is a payment callback
  const isPaymentCallback = () => {
    return location.pathname.includes('/payment') || 
           location.search.includes('success=') ||
           location.search.includes('payment_id=') ||
           location.search.includes('order_id=');
  };

  useEffect(() => {
    const initializeAuth = async () => {
      // If this is a password reset, don't set session
      if (isPasswordReset()) {
        debug("Password reset detected, not setting session");
        setLoading(false);
        return;
      }

      // Enhanced session restoration for payment callbacks
      if (isPaymentCallback() && SessionManager.hasBackup()) {
        debug("Payment callback detected with session backup, attempting restoration");
        
        const restorationResult = await SessionManager.restoreSession();
        if (restorationResult.success && restorationResult.user) {
          debug("Session successfully restored from backup", { userId: restorationResult.user.id });
          
          setSession({ user: restorationResult.user });
          setUser(restorationResult.user);
          
          await fetchUserProfile(restorationResult.user, setUserRole);
          setLoading(false);
          
          // Run orphan recovery for restored session
          runOrphanedPaymentRecovery(restorationResult.user, recoveredOrphaned, setRecoveredOrphaned);
          return;
        } else {
          debug("Session restoration failed, falling back to normal auth check");
        }
      }

      // Normal session check
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("[AUTH] Error getting initial session:", error);
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
          if (isFromSignupConfirmation()) {
            const urlParams = new URLSearchParams(location.search);
            const planId = urlParams.get('plan_id');
            
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
        }
        
        setLoading(false);
      } catch (error) {
        console.error("[AUTH] Session initialization error:", error);
        setLoading(false);
      }
    };

    // Setup auth state changes
    const cleanup = setupAuthState({ 
      setSession, 
      setUser, 
      setUserRole, 
      setLoading, 
      setRecoveredOrphaned 
    });
    
    // Initialize auth
    initializeAuth();
    
    return cleanup;
  }, [location.search, location.pathname, navigate]);

  const signOut = async () => {
    try {
      debug("Starting logout process");
      setLoading(true);
      
      // Clean up any payment session backups
      SessionManager.cleanup();
      
      setSession(null);
      setUser(null);
      setUserRole(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[AUTH] Sign out error:", error);
        throw error;
      }
      
      debug("Logout successful, navigating to login");
      navigate('/login');
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      console.error("[AUTH] Sign out error:", error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive"
      });
    } finally {
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

  debug("Auth context render", { ...contextValue });

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
