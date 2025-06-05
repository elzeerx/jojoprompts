
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
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const fetchPayPalConfig = useCallback(async () => {
    try {
      console.log("Fetching PayPal configuration...");
      setError(null);
      setIsLoading(true);
      
      // Enhanced timeout and connectivity check
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("PayPal configuration request timeout after 15 seconds")), 15000);
      });

      const configPromise = supabase.functions.invoke("get-paypal-config");
      
      const { data, error } = await Promise.race([configPromise, timeoutPromise]) as any;
      
      if (error) {
        console.error("Error fetching PayPal config:", error);
        
        // Provide specific error messages based on error type
        if (error.message?.includes('fetch')) {
          throw new Error("Network connection failed. Please check your internet connection.");
        } else if (error.message?.includes('timeout')) {
          throw new Error("PayPal service is taking too long to respond. Please try again.");
        } else {
          throw new Error(`PayPal configuration error: ${error.message || 'Service temporarily unavailable'}`);
        }
      }

      if (!data?.clientId) {
        console.error("No PayPal client ID in response:", data);
        throw new Error("PayPal is not properly configured. Please contact support.");
      }

      console.log("PayPal config loaded successfully:", { environment: data.environment });
      setPaypalConfig(data);
      setRetryCount(0);
      setIsLoading(false);
    } catch (error: any) {
      console.error("Failed to fetch PayPal config:", error);
      
      // Circuit breaker pattern with exponential backoff
      if (retryCount < 2 && (
        error.message?.includes('timeout') || 
        error.message?.includes('network') || 
        error.message?.includes('fetch') ||
        error.message?.includes('Failed to fetch')
      )) {
        const delay = Math.pow(2, retryCount) * 3000; // 3s, 6s, 12s
        console.log(`Retrying PayPal config fetch in ${delay}ms... (attempt ${retryCount + 1})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchPayPalConfig(), delay);
      } else {
        let errorMessage = "PayPal is temporarily unavailable. Please try again later.";
        
        if (error.message?.includes('timeout')) {
          errorMessage = "Connection timeout. Please check your internet connection and try again.";
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message?.includes('configuration')) {
          errorMessage = "PayPal service configuration error. Please contact support.";
        }
        
        setError(errorMessage);
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
