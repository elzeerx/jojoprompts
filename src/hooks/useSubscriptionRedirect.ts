import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSubscription } from "./useUserSubscription";

export function useSubscriptionRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, loading: authLoading } = useAuth();
  const { userSubscription, isLoading: subscriptionLoading } = useUserSubscription(user?.id);

  useEffect(() => {
    // Don't redirect if still loading or no user
    if (authLoading || subscriptionLoading || !user) return;
    
    // Don't redirect admins, prompters, or jadmins
    if (userRole === 'admin' || userRole === 'prompter' || userRole === 'jadmin') return;
    
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
      navigate('/pricing', { replace: true });
    }
  }, [authLoading, subscriptionLoading, user, userRole, userSubscription, location.pathname, navigate]);
}