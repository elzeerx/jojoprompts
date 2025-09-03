
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscriptionRedirect } from "@/hooks/useSubscriptionRedirect";
import HomePage from "./HomePage";

export default function Index() {
  const navigate = useNavigate();
  
  console.log('[INDEX] Component mounted');
  
  // Handle subscription-based redirects
  useSubscriptionRedirect();
  
  // Safe auth hook with fallback
  let loading = true;
  let user = null;
  let userRole = null;
  
  try {
    const authContext = useAuth();
    loading = authContext.loading;
    user = authContext.user;
    userRole = authContext.userRole;
    console.log('[INDEX] Auth context:', { loading, user: !!user, userRole });
  } catch (error) {
    console.warn('Auth context unavailable in Index:', error);
    loading = false;
  }

  useEffect(() => {
    if (!loading && user && userRole) {
      // Redirect users based on their role
      if (userRole === 'admin' || userRole === 'jadmin') {
        navigate('/admin');
      } else if (userRole === 'prompter') {
        navigate('/dashboard/prompter');
      }
      // Regular users stay on the home page
    }
  }, [loading, user, userRole, navigate]);

  console.log('[INDEX] Rendering state:', { loading, user: !!user, userRole });

  if (loading) {
    console.log('[INDEX] Showing loader');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  console.log('[INDEX] Rendering HomePage');
  return <HomePage />;
}
