
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
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      
      debug("profile fetched", { profile, role: profile?.role ?? "user" });
      setUserRole(profile?.role ?? "user");
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
    
    // Setup auth state change listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;
        
        debug("Auth state changed", { event, currentSession });
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // For profile fetching, use setTimeout to avoid potential deadlocks with Supabase auth
        if (currentSession?.user) {
          setTimeout(() => {
            if (mounted) {
              fetchUserProfile(currentSession.user.id).finally(() => {
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
        console.error("[AUTH] Error getting session:", error);
        setLoading(false);
        return;
      }
      
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      
      if (initialSession?.user) {
        fetchUserProfile(initialSession.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setSession(null);
      setUser(null);
      setUserRole(null);
      navigate('/login');
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

  return (
    <AuthContext.Provider value={{
      session,
      user,
      userRole,
      isAdmin: userRole === 'admin',
      loading,
      signOut
    }}>
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
