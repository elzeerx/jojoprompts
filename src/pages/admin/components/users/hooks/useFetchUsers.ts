
import { useState, useEffect, useCallback } from "react";
import { UserProfile } from "@/types";
import { supabase } from "@/integrations/supabase/client";

export function useFetchUsers() {
  const [users, setUsers] = useState<(UserProfile & { subscription?: { plan_name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch users through the edge function
      const { data: usersFunctionData, error: usersError } = await supabase.functions.invoke(
        "get-all-users",
        {
          body: { action: "getAll" }
        }
      );

      if (usersError) throw usersError;

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
      console.error("Error fetching users:", error);
      setError(error.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, error, fetchUsers };
}
