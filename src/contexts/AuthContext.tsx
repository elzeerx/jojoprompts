import React, { createContext, useContext, useState } from 'react';
import { AuthContextType } from './authTypes';
import { setupAuthState } from './authStateManager';
import { computeRolePermissions } from './rolePermissions';
import { debug } from './authDebugger';
import { useAuthInitialization } from './auth/useAuthInitialization';
import { useAuthSignOut } from './auth/useAuthSignOut';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [recoveredOrphaned, setRecoveredOrphaned] = useState(false);

  // Initialize authentication
  useAuthInitialization({
    setSession,
    setUser,
    setUserRole,
    setLoading,
    recoveredOrphaned,
    setRecoveredOrphaned,
    isLoggingOut: () => isLoggingOut
  });

  // Setup auth state changes
  React.useEffect(() => {
    const cleanup = setupAuthState({ 
      setSession, 
      setUser, 
      setUserRole, 
      setLoading, 
      setRecoveredOrphaned,
      isLoggingOut: () => isLoggingOut
    });
    
    return cleanup;
  }, [isLoggingOut]);

  // Sign out functionality
  const signOut = useAuthSignOut({
    setIsLoggingOut,
    setSession,
    setUser,
    setUserRole,
    setLoading
  });

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

  debug("Auth context render", { ...contextValue, isLoggingOut });

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
