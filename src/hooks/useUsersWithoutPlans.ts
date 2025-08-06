import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UserWithoutPlan {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  created_at: string;
  email?: string;
}

export function useUsersWithoutPlans() {
  const [users, setUsers] = useState<UserWithoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsersWithoutPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call the edge function to get users without active subscriptions
      const { data, error } = await supabase.functions.invoke('get-users-without-plans');

      if (error) throw error;

      setUsers(data.users || []);
    } catch (error: any) {
      console.error("Error fetching users without plans:", error);
      setError(error.message || "Failed to load users");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users without plans",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersWithoutPlans();
  }, []);

  return {
    users,
    loading,
    error,
    refetch: fetchUsersWithoutPlans,
  };
}