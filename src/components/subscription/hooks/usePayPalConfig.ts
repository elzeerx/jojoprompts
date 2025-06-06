
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
        console.log("Fetching PayPal config...");
        const { data, error } = await supabase.functions.invoke("get-paypal-config");
        
        if (error) {
          throw error;
        }
        
        if (!data?.clientId) {
          throw new Error("PayPal configuration is incomplete");
        }
        
        console.log("PayPal config loaded successfully");
        setConfig(data);
        setError(null);
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
