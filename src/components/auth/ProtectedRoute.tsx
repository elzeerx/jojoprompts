
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireRole?: 'admin' | 'jadmin' | 'prompter' | 'user';
}

export function ProtectedRoute({ children, requireAdmin = false, requireRole }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    } else if (!loading && requireAdmin && userRole !== "admin") {
      navigate("/prompts");
    } else if (!loading && requireRole && userRole !== requireRole) {
      navigate("/prompts");
    }
  }, [user, userRole, requireAdmin, requireRole, navigate, loading]);

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

  if (!user || (requireAdmin && userRole !== "admin") || (requireRole && userRole !== requireRole)) {
    return null;
  }

  return <>{children}</>;
}
