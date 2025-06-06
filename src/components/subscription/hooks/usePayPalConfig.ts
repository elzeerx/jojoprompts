
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PayPalConfig {
  clientId: string;
  environment: string;
  currency: string;
}

export function usePayPalConfig() {
  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("Fetching PayPal config...");
        
        const { data, error: fetchError } = await supabase.functions.invoke("get-paypal-config");
        
        if (fetchError) {
          console.error("PayPal config fetch error:", fetchError);
          throw new Error(fetchError.message || "Failed to fetch PayPal config");
        }
        
        if (!data?.clientId) {
          throw new Error("Invalid PayPal configuration received");
        }
        
        console.log("PayPal config loaded successfully:", { environment: data.environment });
        setConfig(data);
        
      } catch (err: any) {
        console.error("PayPal config error:", err);
        setError(err.message || "Failed to load PayPal configuration");
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return { config, loading, error };
}
