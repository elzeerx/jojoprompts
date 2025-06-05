
import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useTapPaymentScript } from "./useTapPaymentScript";
import { usePaymentConversion } from "./usePaymentConversion";
import { useTapPaymentInitialization } from "./useTapPaymentInitialization";

interface UseTapPaymentFlowProps {
  amount: number;
  planName: string;
  onSuccess: (paymentId: string) => void;
  onError?: (error: any) => void;
  currency?: string;
}

export function useTapPaymentFlow({
  amount,
  planName,
  onSuccess,
  onError,
  currency = "KWD"
}: UseTapPaymentFlowProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { user } = useAuth();
  
  const { loadTapPaymentScript } = useTapPaymentScript();
  const { getKWDAmount } = usePaymentConversion();
  const { initializeTapPayment } = useTapPaymentInitialization();

  const handleSuccess = useCallback((paymentId: string) => {
    console.log("Secure Tap payment successful:", paymentId);
    setError(null);
    setIsLoading(false);
    onSuccess(paymentId);
  }, [onSuccess]);

  const handleError = useCallback((error: any) => {
    console.error("Secure Tap payment error:", error);
    const errorMessage = typeof error === 'string' ? error : error?.message || "Tap payment failed";
    setError(errorMessage);
    setIsLoading(false);
    if (onError) onError(error);
  }, [onError]);

  const initializePayment = useCallback(async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to continue with payment",
        variant: "destructive",
      });
      return;
    }

    setError(null);
    setIsLoading(true);
    
    try {
      console.log("Step 1: Initializing Tap payment for amount:", amount, currency);
      
      // Enhanced timeout and retry logic
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout after 20 seconds")), 20000);
      });

      const configPromise = supabase.functions.invoke("create-tap-session", {
        body: { amount, planName, currency }
      });

      console.log("Step 2: Calling create-tap-session edge function");
      const { data: config, error: configError } = await Promise.race([
        configPromise,
        timeoutPromise
      ]) as any;

      if (configError) {
        console.error("Tap configuration error:", configError);
        throw new Error(`Tap configuration error: ${configError.message || 'Failed to initialize payment'}`);
      }

      if (!config || !config.publishableKey) {
        console.error("Invalid Tap configuration response:", config);
        throw new Error("Failed to get payment configuration from server");
      }

      console.log("Step 3: Tap configuration loaded successfully");

      // Load Tap script if not already loaded
      if (!window.Tapjsli) {
        console.log("Step 4: Loading Tap payment script...");
        await loadTapPaymentScript();
        
        // Wait for script to be fully ready
        let attempts = 0;
        while (!window.Tapjsli && attempts < 30) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!window.Tapjsli) {
          throw new Error("Tap payment script failed to load properly");
        }
      }
      
      console.log("Step 5: Initializing Tap payment interface");
      
      // Give some time for script to initialize and DOM to be ready
      setTimeout(() => {
        try {
          const tapAmount = currency === "KWD" ? getKWDAmount(amount) : amount;
          
          console.log("Step 6: Creating Tap payment with:", {
            amount: tapAmount,
            currency,
            container: "secure-tap-payment-container"
          });
          
          initializeTapPayment({
            containerID: "secure-tap-payment-container",
            amount: tapAmount,
            currency,
            onSuccess: (response: any) => {
              console.log("Tap payment completed successfully:", response);
              handleSuccess(response.transaction?.id || response.id);
            },
            onError: (error: any) => {
              console.error("Tap payment failed:", error);
              handleError(error);
            },
            onClose: () => {
              console.log("Tap payment dialog closed by user");
              setIsLoading(false);
            }
          }, config.publishableKey);
          
          setIsLoading(false);
          setRetryCount(0);
        } catch (initError) {
          console.error("Error during Tap initialization:", initError);
          handleError(initError);
        }
      }, 1000);
      
    } catch (error: any) {
      console.error("Error initializing secure Tap payment:", error);
      
      // Implement circuit breaker pattern with exponential backoff
      if (retryCount < 2 && (
        error.message?.includes('timeout') || 
        error.message?.includes('network') || 
        error.message?.includes('fetch') ||
        error.message?.includes('Failed to fetch')
      )) {
        const delay = Math.pow(2, retryCount) * 3000; // 3s, 6s, 12s
        console.log(`Retrying Tap payment initialization in ${delay}ms... (attempt ${retryCount + 1})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          setIsLoading(false);
          initializePayment();
        }, delay);
      } else {
        let errorMessage = "Tap Payment is temporarily unavailable. Please try again later.";
        
        if (error.message?.includes('timeout')) {
          errorMessage = "Connection timeout. Please check your internet connection and try again.";
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message?.includes('configuration')) {
          errorMessage = "Payment service configuration error. Please contact support.";
        } else if (error.message?.includes('script')) {
          errorMessage = "Payment interface failed to load. Please refresh the page and try again.";
        }
        
        setError(errorMessage);
        setIsLoading(false);
      }
    }
  }, [user, amount, planName, currency, retryCount, loadTapPaymentScript, getKWDAmount, initializeTapPayment, handleSuccess, handleError]);

  const resetError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  return {
    isLoading,
    error,
    initializePayment,
    resetError
  };
}
