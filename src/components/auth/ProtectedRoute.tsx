
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else if (requireAdmin && userRole !== "admin") {
      navigate("/prompts");
    }
  }, [user, userRole, requireAdmin, navigate]);

  if (!user || (requireAdmin && userRole !== "admin")) {
    return null;
  }

  return <>{children}</>;
}
