import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";

/**
 * Hook to determine if the current user is the super admin (nawaf@elzeer.com)
 * Super admin has complete control over all user management operations
 */
export function useSuperAdmin() {
  const { user, isAdmin } = useAuth();

  const isSuperAdmin = useMemo(() => {
    return isAdmin && user?.email === 'nawaf@elzeer.com';
  }, [isAdmin, user?.email]);

  return {
    isSuperAdmin,
    superAdminEmail: 'nawaf@elzeer.com',
    currentUserEmail: user?.email || null
  };
}
