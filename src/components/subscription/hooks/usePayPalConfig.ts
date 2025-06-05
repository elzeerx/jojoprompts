
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PayPalConfig {
  clientId: string;
  environment: string;
  currency: string;
}

export function usePayPalConfig() {
  const [paypalConfig, setPaypalConfig] = useState<PayPalConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const fetchPayPalConfig = useCallback(async () => {
    try {
      console.log("Fetching PayPal configuration...");
      setError(null);
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke("get-paypal-config");
      
      if (error) {
        console.error("Error fetching PayPal config:", error);
        throw new Error(`PayPal configuration error: ${error.message || 'Failed to load PayPal settings'}`);
      }

      if (!data?.clientId) {
        console.error("No PayPal client ID in response:", data);
        throw new Error("PayPal is not configured. Please contact support.");
      }

      console.log("PayPal config loaded successfully:", { environment: data.environment });
      setPaypalConfig(data);
      setRetryCount(0);
    } catch (error: any) {
      console.error("Failed to fetch PayPal config:", error);
      
      if (retryCount < 2) {
        console.log(`Retrying PayPal config fetch... (attempt ${retryCount + 1})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchPayPalConfig(), Math.pow(2, retryCount) * 2000);
      } else {
        setError("PayPal is temporarily unavailable. Please try again later.");
        setIsLoading(false);
      }
    }
  }, [retryCount]);

  const resetConfig = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setRetryCount(0);
    fetchPayPalConfig();
  }, [fetchPayPalConfig]);

  return {
    paypalConfig,
    error,
    isLoading,
    fetchPayPalConfig,
    resetConfig
  };
}
