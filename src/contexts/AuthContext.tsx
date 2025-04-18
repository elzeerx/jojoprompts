import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          
          console.log("[AUTH] profile fetched", { profile, role: profile?.role ?? "user" });
          setUserRole(profile?.role ?? "user");
          setLoading(false);
          
          debug("state updated", { event, session, userRole: profile?.role ?? "user", loading: false });
        } else {
          setUserRole(null);
          debug("state cleared", { event, loading: false });
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            console.log("[AUTH] profile fetched", { profile, role: profile?.role ?? "user" });
            setUserRole(profile?.role ?? "user");
            setLoading(false);
            debug("initial state loaded", { session, userRole: profile?.role ?? "user", loading: false });
          });
      } else {
        setLoading(false);
        debug("no initial session", { loading: false });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setSession(null);
      setUser(null);
      setUserRole(null);
      navigate('/login');
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
