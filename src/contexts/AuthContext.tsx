
import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: string | null;
  isAdmin: boolean;
  isJadmin: boolean;
  isPrompter: boolean;
  canDeleteUsers: boolean;
  canCancelSubscriptions: boolean;
  canManagePrompts: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const debug = (msg: string, extra = {}) => 
  console.log("[AUTH]", msg, extra);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Helper function to fetch user profile safely
  const fetchUserProfile = async (currentUser: User) => {
    try {
      debug("Fetching profile for user", { userId: currentUser.id, email: currentUser.email });
      
      // Special case for nawaf@elzeer.com - always admin
      if (currentUser.email === 'nawaf@elzeer.com') {
        debug("Special admin case: nawaf@elzeer.com detected - setting admin role");
        setUserRole("admin");
        return;
      }
      
      // Using maybeSingle instead of single to avoid errors when profile doesn't exist
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .maybeSingle();
      
      if (error) {
        console.error("[AUTH] Error fetching profile:", error);
        throw error;
      }
      
      // Set role with a fallback to "user" if the profile doesn't exist or role is null
      const role = profile?.role || "user";
      debug("Profile fetched", { profile, role, userEmail: currentUser.email });
      setUserRole(role);
    } catch (error) {
      console.error("[AUTH] Error fetching profile:", error);
      setUserRole("user"); // Default to user role on error
      toast({
        title: "Warning",
        description: "Could not load user profile data. Some features may be limited.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    
    debug("Setting up auth state listener");
    
    // Setup auth state change listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        
        debug("Auth state changed", { event, sessionExists: !!currentSession, userEmail: currentSession?.user?.email });
        
        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          // Use setTimeout to avoid potential deadlocks with Supabase auth
          setTimeout(() => {
            if (mounted) {
              fetchUserProfile(currentUser).finally(() => {
                if (mounted) setLoading(false);
              });
            }
          }, 0);
        } else {
          setUserRole(null);
          if (mounted) setLoading(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!mounted) return;
      
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
        fetchUserProfile(initialUser).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      debug("Auth context cleanup");
    };
  }, []);

  const signOut = async () => {
    try {
      debug("Starting logout process");
      setLoading(true);
      
      // Clear local state first
      setSession(null);
      setUser(null);
      setUserRole(null);
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("[AUTH] Sign out error:", error);
        throw error;
      }
      
      debug("Logout successful, navigating to pricing");
      navigate('/pricing');
      
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

  // Computed properties for role-based access
  const isAdmin = userRole === 'admin';
  const isJadmin = userRole === 'jadmin';
  const isPrompter = userRole === 'prompter';
  const canDeleteUsers = isAdmin; // Only full admins can delete users
  const canCancelSubscriptions = isAdmin; // Only full admins can cancel subscriptions
  const canManagePrompts = isAdmin || isJadmin || isPrompter;

  const contextValue = {
    session,
    user,
    userRole,
    isAdmin,
    isJadmin,
    isPrompter,
    canDeleteUsers,
    canCancelSubscriptions,
    canManagePrompts,
    loading,
    signOut
  };

  debug("Auth context render", { 
    userEmail: user?.email, 
    userRole, 
    isAdmin, 
    isJadmin, 
    isPrompter,
    canDeleteUsers,
    canCancelSubscriptions,
    canManagePrompts,
    loading 
  });

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
