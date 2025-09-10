/**
 * Minimal Subscription Redirect Hook
 * 
 * This hook provides basic subscription-based redirection logic.
 * Most functionality is now handled by the Guard component.
 * 
 * @deprecated Consider using Guard component instead for new implementations
 */

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSubscription } from "./useUserSubscription";

interface UseSubscriptionRedirectOptions {
  enableRedirect?: boolean;
  pricingRoute?: string;
  exemptRoles?: string[];
}

export function useSubscriptionRedirect(options: UseSubscriptionRedirectOptions = {}) {
  const {
    enableRedirect = true,
    pricingRoute = '/pricing',
    exemptRoles = ['admin', 'prompter', 'jadmin']
  } = options;

  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, loading: authLoading } = useAuth();
  const { userSubscription, isLoading: subscriptionLoading } = useUserSubscription(user?.id);

  useEffect(() => {
    if (!enableRedirect) return;
    
    // Don't redirect if still loading or no user
    if (authLoading || subscriptionLoading || !user) return;
    
    // Don't redirect exempt roles
    if (exemptRoles.includes(userRole || '')) return;
    
    // Don't redirect if user already has an active subscription
    if (userSubscription) return;
    
    // Don't redirect if already on pricing, checkout, auth pages, or public pages
    const currentPath = location.pathname;
    const excludedPaths = [
      '/pricing', '/checkout', '/auth', '/signup', '/login',
      '/prompts', '/examples', '/about', '/contact', '/faq', 
      '/privacy', '/terms', '/search', '/prompt-generator'
    ];
    if (excludedPaths.some(path => currentPath.startsWith(path))) return;
    
    // Only redirect if trying to access premium/dashboard routes
    const premiumPaths = ['/dashboard', '/favorites', '/payment-dashboard'];
    const isPremiumRoute = premiumPaths.some(path => currentPath.startsWith(path));
    
    if (userRole === 'user' && isPremiumRoute) {
      console.log('Redirecting user without subscription from premium route to pricing page');
      navigate(pricingRoute, { replace: true });
    }
  }, [
    enableRedirect,
    authLoading,
    subscriptionLoading,
    user,
    userRole,
    userSubscription,
    location.pathname,
    navigate,
    pricingRoute,
    exemptRoles
  ]);
}

// Legacy export for backwards compatibility
export { useSubscriptionRedirect as default };