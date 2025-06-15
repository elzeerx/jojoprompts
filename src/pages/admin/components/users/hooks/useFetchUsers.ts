
import { useState, useEffect, useCallback } from "react";
import { UserProfile } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export function useFetchUsers() {
  const [users, setUsers] = useState<(UserProfile & { subscription?: { plan_name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { session, loading: authLoading } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!session?.access_token) {
        setError("No admin session token; please log in or refresh.");
        return;
      }

      // Fetch users through the edge function, always send Authorization header
      const { data: usersFunctionData, error: usersError } = await supabase.functions.invoke(
        "get-all-users",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: { action: "list" }
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

      // Enhancement: Get user subscriptions
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('user_subscriptions')
        .select('user_id, plan_id(id, name)')
        .eq('status', 'active');

      if (subscriptionsError) throw subscriptionsError;

      // Map subscriptions to users
      const usersWithSubscriptions = usersFunctionData.users.map((user: UserProfile) => {
        const subscription = subscriptions?.find((sub: any) => sub.user_id === user.id);
        return {
          ...user,
          subscription: subscription ? { plan_name: subscription.plan_id?.name } : null
        };
      });

      setUsers(usersWithSubscriptions || []);
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
  }, [session?.access_token]);

  useEffect(() => {
    if (!authLoading) {
      fetchUsers();
    }
  }, [fetchUsers, authLoading]);

  return { users, loading, error, fetchUsers };
}
