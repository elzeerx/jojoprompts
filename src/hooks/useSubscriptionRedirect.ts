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
    // Don't redirect if still loading or on certain protected routes
    if (authLoading || subscriptionLoading || !user) return;
    
    // Don't redirect admins, prompters, or jadmins
    if (userRole === 'admin' || userRole === 'prompter' || userRole === 'jadmin') return;
    
    // Don't redirect if user already has an active subscription
    if (userSubscription) return;
    
    // Don't redirect if already on pricing, checkout, or auth pages
    const currentPath = location.pathname;
    const excludedPaths = ['/pricing', '/checkout', '/auth', '/signup', '/login'];
    if (excludedPaths.some(path => currentPath.startsWith(path))) return;
    
    // Regular users without subscription should be redirected to pricing
    if (userRole === 'user') {
      console.log('Redirecting user without subscription to pricing page');
      navigate('/pricing', { replace: true });
    }
  }, [authLoading, subscriptionLoading, user, userRole, userSubscription, location.pathname, navigate]);
}