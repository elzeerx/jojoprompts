/**
 * Unified Guard Component
 * 
 * Consolidates authentication, role-based access, and subscription checks
 * into a single, flexible component that replaces ProtectedRoute, RouteGuard, and SubscriptionGuard.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSubscription } from '@/hooks/useUserSubscription';
import { UserRole, hasRoleLevel, hasPermission, canRoleAccessFeature } from '@/contexts/roles';
import { securityLogger } from '@/utils/security/securityLogger';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Crown, ArrowRight, Shield, AlertTriangle, Loader2 } from 'lucide-react';

// ===== INTERFACES =====

interface GuardProps {
  children: React.ReactNode;
  
  // Authentication requirements
  requireAuth?: boolean;
  
  // Role-based access
  requireRole?: UserRole;
  allowedRoles?: UserRole[];
  
  // Permission-based access
  requirePermissions?: string[];
  requireAllPermissions?: boolean; // true = AND logic, false = OR logic
  
  // Feature-based access (maps to permissions internally)
  requireFeature?: string;
  
  // Subscription requirements
  requireSubscription?: boolean;
  exemptRoles?: UserRole[]; // Roles exempt from subscription requirements
  
  // Behavior configuration
  fallbackRoute?: string;
  loginRoute?: string;
  pricingRoute?: string;
  
  // UI configuration
  showLoadingState?: boolean;
  showUnauthorizedMessage?: boolean;
  showSubscriptionPrompt?: boolean;
  
  // Custom loading/error components
  loadingComponent?: React.ReactNode;
  unauthorizedComponent?: React.ReactNode;
  subscriptionPromptComponent?: React.ReactNode;
}

// ===== GUARD STATES =====

type GuardState = 
  | 'loading'
  | 'checking-auth' 
  | 'checking-subscription'
  | 'authorized'
  | 'unauthorized-auth'
  | 'unauthorized-role'
  | 'unauthorized-permission'
  | 'unauthorized-subscription';

// ===== MAIN COMPONENT =====

export function Guard({
  children,
  
  // Authentication
  requireAuth = true,
  
  // Role-based access
  requireRole,
  allowedRoles,
  
  // Permission-based access  
  requirePermissions = [],
  requireAllPermissions = true,
  
  // Feature-based access
  requireFeature,
  
  // Subscription requirements
  requireSubscription = false,
  exemptRoles = ['admin', 'prompter', 'jadmin'],
  
  // Routes
  fallbackRoute = '/prompts',
  loginRoute = '/login', 
  pricingRoute = '/pricing',
  
  // UI configuration
  showLoadingState = true,
  showUnauthorizedMessage = true,
  showSubscriptionPrompt = true,
  
  // Custom components
  loadingComponent,
  unauthorizedComponent,
  subscriptionPromptComponent,
}: GuardProps) {
  
  // ===== HOOKS =====
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, loading: authLoading } = useAuth();
  const { userSubscription, isLoading: subscriptionLoading } = useUserSubscription(user?.id);
  
  // ===== STATE =====
  
  const [guardState, setGuardState] = useState<GuardState>('loading');
  const [unauthorizedReason, setUnauthorizedReason] = useState<string>('');

  // ===== GUARD LOGIC =====
  
  useEffect(() => {
    if (authLoading) {
      setGuardState('loading');
      return;
    }

    // Log access attempt
    securityLogger.logRouteAccess({
      path: location.pathname,
      userRole: userRole || 'anonymous',
      userId: user?.id,
      requiredRole: requireRole,
      requiredPermissions: requirePermissions,
    });

    setGuardState('checking-auth');

    // 1. Check Authentication
    if (requireAuth && !user) {
      setGuardState('unauthorized-auth');
      setUnauthorizedReason('Authentication required');
      navigate(loginRoute, { state: { from: location.pathname } });
      return;
    }

    // If no auth required and no user, allow access
    if (!requireAuth && !user) {
      setGuardState('authorized');
      return;
    }

    // 2. Check Role-based Access
    if (requireRole && userRole) {
      if (!hasRoleLevel(userRole as UserRole, requireRole)) {
        const reason = `Insufficient privileges. Required: ${requireRole}, Current: ${userRole}`;
        setGuardState('unauthorized-role');
        setUnauthorizedReason(reason);
        
        securityLogger.logUnauthorizedAccess({
          path: location.pathname,
          userRole: userRole || 'unknown',
          userId: user?.id || 'unknown',
          requiredRole: requireRole,
          reason,
        });
        
        if (!showUnauthorizedMessage) {
          navigate(fallbackRoute);
        }
        return;
      }
    }

    // 3. Check Allowed Roles
    if (allowedRoles && allowedRoles.length > 0 && userRole) {
      const hasAllowedRole = allowedRoles.some(role => hasRoleLevel(userRole as UserRole, role));
      if (!hasAllowedRole) {
        const reason = `Role not allowed. Allowed: ${allowedRoles.join(', ')}, Current: ${userRole}`;
        setGuardState('unauthorized-role');
        setUnauthorizedReason(reason);
        
        securityLogger.logUnauthorizedAccess({
          path: location.pathname,
          userRole: userRole || 'unknown', 
          userId: user?.id || 'unknown',
          requiredPermissions: requirePermissions,
          reason,
        });
        
        if (!showUnauthorizedMessage) {
          navigate(fallbackRoute);
        }
        return;
      }
    }

    // 4. Check Permission-based Access
    if (requirePermissions.length > 0 && userRole) {
      const checkPermissions = requireAllPermissions 
        ? requirePermissions.every(perm => hasPermission(userRole as UserRole, perm))
        : requirePermissions.some(perm => hasPermission(userRole as UserRole, perm));
        
      if (!checkPermissions) {
        const reason = `Missing required permissions: ${requirePermissions.join(', ')}`;
        setGuardState('unauthorized-permission');
        setUnauthorizedReason(reason);
        
        securityLogger.logUnauthorizedAccess({
          path: location.pathname,
          userRole: userRole || 'unknown',
          userId: user?.id || 'unknown',
          requiredPermissions: requirePermissions,
          reason,
        });
        
        if (!showUnauthorizedMessage) {
          navigate(fallbackRoute);
        }
        return;
      }
    }

    // 5. Check Feature-based Access
    if (requireFeature && userRole) {
      if (!canRoleAccessFeature(userRole as UserRole, requireFeature)) {
        const reason = `Feature access denied: ${requireFeature}`;
        setGuardState('unauthorized-permission');
        setUnauthorizedReason(reason);
        
        if (!showUnauthorizedMessage) {
          navigate(fallbackRoute);
        }
        return;
      }
    }

    // 6. Check Subscription Requirements
    if (requireSubscription) {
      setGuardState('checking-subscription');
      
      if (subscriptionLoading) {
        return; // Still loading subscription data
      }
      
      // Check if user role is exempt from subscription requirements
      const isExempt = exemptRoles.includes(userRole as UserRole);
      
      if (!isExempt && !userSubscription) {
        setGuardState('unauthorized-subscription');
        setUnauthorizedReason('Active subscription required');
        
        if (!showSubscriptionPrompt) {
          navigate(pricingRoute, { replace: true });
        }
        return;
      }
    }

    // All checks passed
    setGuardState('authorized');
    
  }, [
    authLoading,
    subscriptionLoading,
    user,
    userRole,
    userSubscription,
    location.pathname,
    requireAuth,
    requireRole,
    allowedRoles,
    requirePermissions,
    requireAllPermissions,
    requireFeature,
    requireSubscription,
    exemptRoles,
    navigate,
    loginRoute,
    fallbackRoute,
    pricingRoute,
    showUnauthorizedMessage,
    showSubscriptionPrompt,
  ]);

  // ===== RENDER LOGIC =====

  // Loading states
  if (guardState === 'loading' || guardState === 'checking-auth' || guardState === 'checking-subscription') {
    if (!showLoadingState) return null;
    
    if (loadingComponent) return <>{loadingComponent}</>;
    
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="space-y-4 text-center max-w-md">
          <Shield className="h-8 w-8 animate-pulse text-warm-gold mx-auto" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px] mx-auto" />
            <Skeleton className="h-4 w-[150px] mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground">
            {guardState === 'checking-subscription' ? 'Checking subscription...' : 'Verifying access...'}
          </p>
        </div>
      </div>
    );
  }

  // Subscription prompt
  if (guardState === 'unauthorized-subscription') {
    if (!showSubscriptionPrompt) return null;
    
    if (subscriptionPromptComponent) return <>{subscriptionPromptComponent}</>;
    
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
                <Crown className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Premium Access Required
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-muted-foreground text-lg">
                You need an active subscription to access this feature.
              </p>
              
              <div className="bg-white/50 rounded-lg p-4 border border-amber-200">
                <h3 className="font-semibold text-amber-800 mb-2">What you'll get:</h3>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• Access to premium AI prompts</li>
                  <li>• Personal dashboard with favorites</li>
                  <li>• Advanced prompt management tools</li>
                  <li>• Priority customer support</li>
                </ul>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  onClick={() => navigate(pricingRoute)}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                >
                  View Pricing Plans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  Back to Home
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Already have a subscription? Try refreshing the page or contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Other unauthorized states (excluding subscription)
  const otherUnauthorizedStates: GuardState[] = ['unauthorized-auth', 'unauthorized-role', 'unauthorized-permission'];
  if (otherUnauthorizedStates.includes(guardState)) {
    if (!showUnauthorizedMessage) return null;
    
    if (unauthorizedComponent) return <>{unauthorizedComponent}</>;
    
    return (
      <div className="flex h-[50vh] items-center justify-center p-6">
        <div className="max-w-md space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <div className="font-medium">Access Denied</div>
              <div className="text-sm">{unauthorizedReason}</div>
            </AlertDescription>
          </Alert>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Go Back
            </Button>
            <Button onClick={() => navigate("/")}>
              Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Authorized - render children
  if (guardState === 'authorized') {
    return <>{children}</>;
  }

  // Fallback - should not reach here
  return null;
}

// ===== CONVENIENCE COMPONENTS =====

// Auth-only guard
export function AuthGuard({ children, ...props }: Omit<GuardProps, 'requireAuth'>) {
  return (
    <Guard requireAuth={true} {...props}>
      {children}
    </Guard>
  );
}

// Role-based guard
export function RoleGuard({ children, role, ...props }: Omit<GuardProps, 'requireRole'> & { role: UserRole }) {
  return (
    <Guard requireRole={role} {...props}>
      {children}
    </Guard>
  );
}

// Subscription guard  
export function PremiumGuard({ children, ...props }: Omit<GuardProps, 'requireSubscription'>) {
  return (
    <Guard requireSubscription={true} {...props}>
      {children}
    </Guard>
  );
}

// Admin guard
export function AdminGuard({ children, ...props }: Omit<GuardProps, 'requireRole'>) {
  return (
    <Guard requireRole="admin" {...props}>
      {children}
    </Guard>
  );
}

// Combined auth + subscription guard
export function AuthPremiumGuard({ children, ...props }: Omit<GuardProps, 'requireAuth' | 'requireSubscription'>) {
  return (
    <Guard requireAuth={true} requireSubscription={true} {...props}>
      {children}
    </Guard>
  );
}
