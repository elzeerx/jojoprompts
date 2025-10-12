import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface AdminUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  subscription: {
    plan_name: string;
    status: string;
    is_lifetime: boolean;
  } | null;
}

export function useAdminUsers(page: number = 1, limit: number = 10, search: string = "") {
  const { session, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-users-direct', page, limit, search],
    queryFn: async () => {
      console.log('[AdminUsers] Fetching users directly from database...');
      
      // Build the query with all joins
      let query = supabase
        .from('profiles')
        .select(`
          id,
          username,
          first_name,
          last_name,
          email,
          created_at,
          user_roles!inner(role),
          user_subscriptions(
            status,
            subscription_plans(
              name,
              is_lifetime
            )
          )
        `, { count: 'exact' });

      // Apply search filter
      if (search) {
        query = query.or(`username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to).order('created_at', { ascending: false });

      const { data: profiles, error: profilesError, count } = await query;

      if (profilesError) {
        console.error('[AdminUsers] Error fetching profiles:', profilesError);
        throw new Error(profilesError.message);
      }

      console.log('[AdminUsers] Fetched profiles:', profiles?.length);

      // Transform data
      const users: AdminUser[] = (profiles || []).map((profile: any) => {
        const subscription = profile.user_subscriptions?.[0];
        return {
          id: profile.id,
          username: profile.username,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email || null,
          role: profile.user_roles?.[0]?.role || 'user',
          created_at: profile.created_at,
          last_sign_in_at: null, // We can't get this without edge function
          email_confirmed_at: null, // We can't get this without edge function
          subscription: subscription ? {
            plan_name: subscription.subscription_plans?.name || 'Unknown',
            status: subscription.status,
            is_lifetime: subscription.subscription_plans?.is_lifetime || false
          } : null
        };
      });

      return {
        users,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      };
    },
    enabled: !!session && isAdmin,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      console.log('[AdminUsers] Deleting user:', userId);
      
      // Use the existing RPC function for deletion
      const { data, error } = await supabase.rpc('admin_delete_user_data', {
        target_user_id: userId
      });

      if (error) {
        console.error('[AdminUsers] Delete error:', error);
        throw error;
      }

      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete user');
      }

      return result;
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "User has been successfully deleted.",
      });
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['admin-users-direct'] });
    },
    onError: (error: any) => {
      console.error('[AdminUsers] Delete mutation error:', error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    }
  });

  return {
    users: data?.users || [],
    total: data?.total || 0,
    totalPages: data?.totalPages || 0,
    loading: isLoading,
    error: error?.message || null,
    refetch,
    deleteUser: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending
  };
}
