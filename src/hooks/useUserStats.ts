import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserStats(userId?: string) {
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [promptCount, setPromptCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchUserStats();
    }
  }, [userId]);

  const fetchUserStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch favorites count
      const { count: favCount, error: favError } = await supabase
        .from("favorites")
        .select("*", { count: "exact" })
        .eq("user_id", userId);

      if (favError) throw favError;

      // Fetch prompts count
      const { count: promptsCount, error: promptsError } = await supabase
        .from("prompts")
        .select("*", { count: "exact" })
        .eq("user_id", userId);

      if (promptsError) throw promptsError;

      setFavoriteCount(favCount || 0);
      setPromptCount(promptsCount || 0);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      setError("Failed to load statistics");
    } finally {
      setIsLoading(false);
    }
  };

  return { favoriteCount, promptCount, isLoading, error, refetch: fetchUserStats };
}