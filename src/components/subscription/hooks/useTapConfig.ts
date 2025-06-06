
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useTapConfig() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTapConfig = async (amount: number, planName: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log("Getting Tap config for:", { amount, planName });
      
      const { data, error: fetchError } = await supabase.functions.invoke("create-tap-session", {
        body: { 
          amount, 
          planName, 
          currency: "KWD" 
        }
      });

      if (fetchError) {
        console.error("Tap config fetch error:", fetchError);
        throw new Error(fetchError.message || "Failed to fetch Tap config");
      }

      if (!data?.publishableKey) {
        console.error("Invalid Tap config received:", data);
        throw new Error("Invalid Tap configuration received");
      }

      console.log("Tap config loaded successfully");
      return data;
      
    } catch (err: any) {
      console.error("Tap config error:", err);
      const errorMessage = err.message || "Failed to load Tap configuration";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return { getTapConfig, loading, error };
}
