
import { useState, useCallback, useEffect } from "react";
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
      
      // Add timeout and retry logic
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Configuration request timeout")), 15000);
      });

      const configPromise = supabase.functions.invoke("get-paypal-config");
      
      const { data, error } = await Promise.race([configPromise, timeoutPromise]) as any;
      
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
      setIsLoading(false);
    } catch (error: any) {
      console.error("Failed to fetch PayPal config:", error);
      
      // Implement exponential backoff for retries
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s, 16s
        console.log(`Retrying PayPal config fetch in ${delay}ms... (attempt ${retryCount + 1})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchPayPalConfig(), delay);
      } else {
        setError("PayPal is temporarily unavailable. Please try again later.");
        setIsLoading(false);
      }
    }
  }, [retryCount]);

  // Auto-fetch configuration on mount
  useEffect(() => {
    fetchPayPalConfig();
  }, []);

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
