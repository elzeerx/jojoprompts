
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    } else if (!loading && requireAdmin && userRole !== "admin") {
      // Don't redirect immediately for admin routes, show access denied
      console.warn("Admin access required but user role is:", userRole);
    }
  }, [user, userRole, requireAdmin, navigate, loading]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <Skeleton className="h-4 w-[100px] mx-auto" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show access denied for admin routes when user is not admin
  if (requireAdmin && userRole !== "admin") {
    return (
      <div className="min-h-screen bg-soft-bg/30 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Access Denied
            </AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                You need administrator privileges to access this area. 
                {userRole && userRole !== 'user' && (
                  <span className="block mt-2 text-sm">
                    Current role: <span className="font-medium">{userRole}</span>
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/')}
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  Go Home
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/prompts')}
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  View Prompts
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
