import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSubscription } from "./useUserSubscription";
import { isPrivilegedUser, isRegularUser } from "@/utils/auth";
import { createLogger } from '@/utils/logging';

const logger = createLogger('SUBSCRIPTION_REDIRECT');

export function useSubscriptionRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, loading: authLoading } = useAuth();
  const { userSubscription, isLoading: subscriptionLoading } = useUserSubscription(user?.id);

  useEffect(() => {
    // Don't redirect if still loading or no user
    if (authLoading || subscriptionLoading || !user) return;
    
    // Don't redirect admins, prompters, or jadmins
    if (isPrivilegedUser(userRole)) return;
    
    // Don't redirect if user already has an active subscription
    if (userSubscription) return;
    
    // Don't redirect if already on pricing, checkout, auth pages, or public pages
    const currentPath = location.pathname;
    const excludedPaths = [
      '/pricing', '/checkout', '/auth', '/signup', '/login',
      '/prompts', '/examples', '/about', '/contact', '/faq', 
      '/privacy', '/terms', '/search'
    ];
    if (excludedPaths.some(path => currentPath.startsWith(path))) return;
    
    // Only redirect if trying to access premium/dashboard routes
    const premiumPaths = ['/dashboard', '/favorites', '/payment-dashboard'];
    const isPremiumRoute = premiumPaths.some(path => currentPath.startsWith(path));
    
    if (isRegularUser(userRole) && isPremiumRoute) {
      logger.info('Redirecting user without subscription', { path: currentPath, userRole });
      navigate('/pricing', { replace: true });
    }
  }, [authLoading, subscriptionLoading, user, userRole, userSubscription, location.pathname, navigate]);
}