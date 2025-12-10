import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to determine if the current user is a super admin
 * Super admins are determined by the is_super_admin flag in user_roles table
 * Super admin has complete control over all user management operations
 */
export function useSuperAdmin() {
  const { user, isAdmin } = useAuth();

  // Query super admin status from database
  const { data: superAdminData } = useQuery({
    queryKey: ['superAdmin', user?.id],
    queryFn: async () => {
      if (!user?.id || !isAdmin) return { isSuperAdmin: false };
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('is_super_admin')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        console.error('Error checking super admin status:', error);
        return { isSuperAdmin: false };
      }

      return { isSuperAdmin: data?.is_super_admin || false };
    },
    enabled: !!user?.id && isAdmin,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isSuperAdmin = useMemo(() => {
    return superAdminData?.isSuperAdmin || false;
  }, [superAdminData]);

  return {
    isSuperAdmin,
    currentUserEmail: user?.email || null
  };
}
