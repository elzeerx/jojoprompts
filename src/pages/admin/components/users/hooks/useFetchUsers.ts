
import { useState, useEffect, useCallback } from "react";
import { UserProfile } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface UseFetchUsersParams {
  page?: number;
  limit?: number;
  search?: string;
}

interface UseFetchUsersReturn {
  users: (UserProfile & { subscription?: { plan_name: string } | null })[];
  loading: boolean;
  error: string | null;
  total: number;
  totalPages: number;
  currentPage: number;
  fetchUsers: () => void;
}

export function useFetchUsers({ page = 1, limit = 10, search = "" }: UseFetchUsersParams = {}): UseFetchUsersReturn {
  const [users, setUsers] = useState<(UserProfile & { subscription?: { plan_name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const { session, loading: authLoading } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!session?.access_token) {
        setError("No admin session token; please log in or refresh.");
        return;
      }

      // Build query parameters for server-side pagination
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (search) {
        params.append('search', search);
      }

      // Create the function URL with query parameters
      const functionUrl = `get-all-users?${params.toString()}`;

      // Fetch users through the edge function using GET request with pagination parameters in URL
      const { data: usersFunctionData, error: usersError } = await supabase.functions.invoke(
        functionUrl,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          method: "GET"
        }
      );

      if (usersError) {
        // Handle unauthorized/forbidden with a helpful toast
        if (usersError.status === 401 || usersError.status === 403) {
          toast({
            title: "Admin authentication failed",
            description: "You are not authorized. Please log out and log in as an admin.",
            variant: "destructive"
          });
          setError(usersError.message || "Unauthorized. Only admins can access this section.");
          return;
        }
        throw usersError;
      }

      // Enhancement: Get user subscriptions - get most recent active subscription per user
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('user_subscriptions')
        .select('user_id, plan_id(id, name), created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (subscriptionsError) throw subscriptionsError;

      // Map subscriptions to users - get most recent subscription per user
      const usersWithSubscriptions = usersFunctionData.users.map((user: UserProfile) => {
        // Find the most recent subscription for this user
        const userSubscriptions = subscriptions?.filter((sub: any) => sub.user_id === user.id) || [];
        const latestSubscription = userSubscriptions.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        return {
          ...user,
          subscription: latestSubscription ? { plan_name: latestSubscription.plan_id?.name } : null
        };
      });

      setUsers(usersWithSubscriptions || []);
      setTotal(usersFunctionData.total || 0);
      setTotalPages(usersFunctionData.totalPages || 0);
    } catch (error: any) {
      // If auth error, prompt and refresh session
      if (error?.message?.includes("token") || error?.message?.includes("auth")) {
        toast({
          title: "Session expired",
          description: "Please log out and log in again as admin.",
          variant: "destructive"
        });
      }
      console.error("Error fetching users:", error);
      setError(error.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, page, limit, search]);

  useEffect(() => {
    if (!authLoading) {
      fetchUsers();
    }
  }, [fetchUsers, authLoading]);

  return { 
    users, 
    loading, 
    error, 
    total,
    totalPages,
    currentPage: page,
    fetchUsers 
  };
}
