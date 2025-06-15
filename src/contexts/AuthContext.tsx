import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { AuthContextType } from './authTypes';
import { fetchUserProfile } from './profileService';
import { setupAuthState } from './authStateManager';
import { runOrphanedPaymentRecovery } from './orphanedPaymentRecovery';
import { computeRolePermissions } from './rolePermissions';
import { debug } from './authDebugger';
import { supabase } from '@/integrations/supabase/client';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [recoveredOrphaned, setRecoveredOrphaned] = useState(false);

  useEffect(() => {
    // Setup auth state and recovery logic
    const cleanup = setupAuthState({ setSession, setUser, setUserRole, setLoading, setRecoveredOrphaned });
    // Check existing session for initial recovery logic
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
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
        fetchUserProfile(initialUser, setUserRole).finally(() => {
          setLoading(false);

          // Run orphan recovery on initial session load too, if not already triggered
          runOrphanedPaymentRecovery(initialUser, recoveredOrphaned, setRecoveredOrphaned);
        });
      } else {
        setLoading(false);
      }
    });
    return cleanup;
  }, []);

  const signOut = async () => {
    try {
      debug("Starting logout process");
      setLoading(true);
      setSession(null);
      setUser(null);
      setUserRole(null);
      // Sign out logic as before
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
      // ... keep existing code (error logic) ...
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
