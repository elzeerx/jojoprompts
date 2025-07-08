import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserSubscription {
  id: string;
  plan_id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  subscription_plans: {
    name: string;
    price_usd: number;
    is_lifetime: boolean;
  };
}

export function useUserSubscription(userId?: string) {
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchUserSubscription();
    }
  }, [userId]);

  const fetchUserSubscription = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select(`
          *,
          subscription_plans(name, price_usd, is_lifetime)
        `)
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setUserSubscription(data[0] as UserSubscription);
      }
    } catch (error) {
      console.error("Error fetching subscription:", error);
      setError("Failed to load subscription");
    } finally {
      setIsLoading(false);
    }
  };

  return { userSubscription, isLoading, error, refetch: fetchUserSubscription };
}