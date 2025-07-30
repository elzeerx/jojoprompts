import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { securityLogger } from "@/utils/security/securityLogger";

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'jadmin' | 'prompter' | 'user';
  requiredPermissions?: string[];
  fallbackRoute?: string;
  showUnauthorizedMessage?: boolean;
}

export function RouteGuard({ 
  children, 
  requiredRole, 
  requiredPermissions = [],
  fallbackRoute = "/prompts",
  showUnauthorizedMessage = true
}: RouteGuardProps) {
  const { user, userRole, loading, isAdmin, isJadmin, isPrompter } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authorizationChecked, setAuthorizationChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [unauthorizedReason, setUnauthorizedReason] = useState<string>("");

  useEffect(() => {
    if (loading) return;

    // Log access attempt
    securityLogger.logRouteAccess({
      path: location.pathname,
      userRole: userRole || 'anonymous',
      userId: user?.id,
      requiredRole,
      requiredPermissions
    });

    // Check authentication
    if (!user) {
      setUnauthorizedReason("Authentication required");
      setIsAuthorized(false);
      setAuthorizationChecked(true);
      navigate("/login", { state: { from: location.pathname } });
      return;
    }

    // Check role-based access
    if (requiredRole) {
      let hasRequiredRole = false;
      
      switch (requiredRole) {
        case 'admin':
          hasRequiredRole = isAdmin;
          break;
        case 'jadmin':
          hasRequiredRole = isAdmin || isJadmin;
          break;
        case 'prompter':
          hasRequiredRole = isAdmin || isJadmin || isPrompter;
          break;
        case 'user':
          hasRequiredRole = true; // Any authenticated user
          break;
      }

      if (!hasRequiredRole) {
        const reason = `Insufficient privileges. Required: ${requiredRole}, Current: ${userRole}`;
        setUnauthorizedReason(reason);
        setIsAuthorized(false);
        setAuthorizationChecked(true);
        
        // Log unauthorized access attempt
        securityLogger.logUnauthorizedAccess({
          path: location.pathname,
          userRole: userRole || 'unknown',
          userId: user.id,
          requiredRole,
          reason
        });
        
        navigate(fallbackRoute);
        return;
      }
    }

    // Check permission-based access
    if (requiredPermissions.length > 0) {
      // This would integrate with a permissions system
      // For now, we'll use role-based permissions
      const userPermissions = getUserPermissions(userRole);
      const hasAllPermissions = requiredPermissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        const reason = `Missing required permissions: ${requiredPermissions.join(', ')}`;
        setUnauthorizedReason(reason);
        setIsAuthorized(false);
        setAuthorizationChecked(true);
        
        securityLogger.logUnauthorizedAccess({
          path: location.pathname,
          userRole: userRole || 'unknown',
          userId: user.id,
          requiredPermissions,
          reason
        });
        
        navigate(fallbackRoute);
        return;
      }
    }

    // All checks passed
    setIsAuthorized(true);
    setAuthorizationChecked(true);
  }, [user, userRole, loading, location.pathname, requiredRole, requiredPermissions, navigate, fallbackRoute, isAdmin, isJadmin, isPrompter]);

  // Helper function to get user permissions based on role
  const getUserPermissions = (role: string | null): string[] => {
    switch (role) {
      case 'admin':
        return ['admin:read', 'admin:write', 'admin:delete', 'prompts:manage', 'users:manage'];
      case 'jadmin':
        return ['admin:read', 'prompts:manage'];
      case 'prompter':
        return ['prompts:create', 'prompts:edit', 'prompts:delete'];
      case 'user':
        return ['prompts:view', 'profile:edit'];
      default:
        return [];
    }
  };

  // Show loading state
  if (loading || !authorizationChecked) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="space-y-4 text-center max-w-md">
          <Shield className="h-8 w-8 animate-pulse text-warm-gold mx-auto" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px] mx-auto" />
            <Skeleton className="h-4 w-[150px] mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground">Verifying access permissions...</p>
        </div>
      </div>
    );
  }

  // Show unauthorized message if configured
  if (!isAuthorized && showUnauthorizedMessage) {
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

  // Return null if not authorized and no message should be shown
  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}