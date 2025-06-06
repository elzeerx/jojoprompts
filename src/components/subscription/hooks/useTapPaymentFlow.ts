
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
  const { user } = useAuth();
  
  const { loadTapPaymentScript } = useTapPaymentScript();
  const { getKWDAmount } = usePaymentConversion();
  const { initializeTapPayment } = useTapPaymentInitialization();

  const handleSuccess = useCallback((paymentId: string) => {
    console.log("Tap payment successful:", paymentId);
    setError(null);
    setIsLoading(false);
    onSuccess(paymentId);
  }, [onSuccess]);

  const handleError = useCallback((error: any) => {
    console.error("Tap payment error:", error);
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
      console.log("Step 1: Starting Tap payment initialization");
      
      // First, ensure we can reach the edge function with a simple health check approach
      const healthCheck = await supabase.functions.invoke("create-tap-session", {
        body: { amount: 1, planName: "test", currency: "KWD" }
      });
      
      if (healthCheck.error) {
        throw new Error(`Edge function not reachable: ${healthCheck.error.message}`);
      }

      console.log("Step 2: Edge function is reachable, proceeding with actual request");
      
      const { data: config, error: configError } = await supabase.functions.invoke("create-tap-session", {
        body: { amount, planName, currency }
      });

      if (configError) {
        console.error("Tap configuration error:", configError);
        throw new Error(`Configuration failed: ${configError.message}`);
      }

      if (!config || !config.publishableKey) {
        console.error("Invalid Tap configuration:", config);
        throw new Error("Invalid payment configuration received");
      }

      console.log("Step 3: Configuration received, loading Tap script");

      // Load Tap script with verification
      await loadTapPaymentScript();
      
      // Verify script loaded properly
      let scriptReady = false;
      for (let i = 0; i < 50; i++) {
        if (window.Tapjsli) {
          scriptReady = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!scriptReady) {
        throw new Error("Tap payment interface failed to load");
      }
      
      console.log("Step 4: Script loaded, initializing payment interface");
      
      // Initialize payment with proper error handling
      setTimeout(() => {
        try {
          const tapAmount = currency === "KWD" ? getKWDAmount(amount) : amount;
          
          initializeTapPayment({
            containerID: "secure-tap-payment-container",
            amount: tapAmount,
            currency,
            onSuccess: (response: any) => {
              console.log("Tap payment completed:", response);
              handleSuccess(response.transaction?.id || response.id);
            },
            onError: (error: any) => {
              console.error("Tap payment interface error:", error);
              handleError(error);
            },
            onClose: () => {
              console.log("Tap payment closed by user");
              setIsLoading(false);
            }
          }, config.publishableKey);
          
          setIsLoading(false);
        } catch (initError) {
          console.error("Payment interface initialization error:", initError);
          handleError(initError);
        }
      }, 1000);
      
    } catch (error: any) {
      console.error("Tap payment initialization failed:", error);
      
      let errorMessage = "Tap Payment is currently unavailable. Please try again later.";
      
      if (error.message?.includes('Edge function not reachable')) {
        errorMessage = "Payment service is temporarily unavailable. Please try again in a few moments.";
      } else if (error.message?.includes('Configuration failed')) {
        errorMessage = "Payment configuration error. Please contact support if this persists.";
      } else if (error.message?.includes('script')) {
        errorMessage = "Payment interface failed to load. Please refresh the page and try again.";
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [user, amount, planName, currency, loadTapPaymentScript, getKWDAmount, initializeTapPayment, handleSuccess, handleError]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    initializePayment,
    resetError
  };
}
