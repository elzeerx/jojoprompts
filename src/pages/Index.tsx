
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HomePage from "./HomePage";
import { getDefaultRoute } from "@/utils/auth";
import { createLogger } from '@/utils/logging';

const logger = createLogger('INDEX_PAGE');

export default function Index() {
  const navigate = useNavigate();
  
  logger.debug('Index component mounted');
  
  // Safe auth hook with fallback
  let loading = true;
  let user = null;
  let userRole = null;
  
  try {
    const authContext = useAuth();
    loading = authContext.loading;
    user = authContext.user;
    userRole = authContext.userRole;
    logger.debug('Auth context loaded', { loading, hasUser: !!user, userRole });
  } catch (error) {
    logger.warn('Auth context unavailable', { error });
    loading = false;
  }

  useEffect(() => {
    if (!loading && user && userRole) {
      // Redirect users based on their role using centralized logic
      const route = getDefaultRoute(userRole);
      if (route !== '/prompts') {
        navigate(route);
      }
      // Regular users stay on the home page
    }
  }, [loading, user, userRole, navigate]);

  logger.debug('Rendering state', { loading, hasUser: !!user, userRole });

  if (loading) {
    logger.debug('Showing loader');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  logger.debug('Rendering HomePage');
  return <HomePage />;
}
