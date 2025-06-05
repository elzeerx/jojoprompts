
import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useTapPaymentScript } from "./hooks/useTapPaymentScript";
import { usePaymentConversion } from "./hooks/usePaymentConversion";
import { useTapPaymentInitialization } from "./hooks/useTapPaymentInitialization";

declare global {
  interface Window {
    Tapjsli?: any;
  }
}

interface SecureTapPaymentButtonProps {
  amount: number;
  planName: string;
  onSuccess: (paymentId: string) => void;
  onError?: (error: any) => void;
  currency?: string;
}

export function SecureTapPaymentButton({
  amount,
  planName,
  onSuccess,
  onError,
  currency = "KWD"
}: SecureTapPaymentButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { user } = useAuth();
  
  const { loadTapPaymentScript } = useTapPaymentScript();
  const { getKWDAmount } = usePaymentConversion();
  const { initializeTapPayment } = useTapPaymentInitialization();
  
  const displayAmount = currency === "KWD" ? getKWDAmount(amount).toFixed(2) : amount.toFixed(2);
  
  const handleSuccess = useCallback((paymentId: string) => {
    console.log("Secure Tap payment successful:", paymentId);
    setIsDialogOpen(false);
    setError(null);
    onSuccess(paymentId);
  }, [onSuccess]);

  const handleError = useCallback((error: any) => {
    console.error("Secure Tap payment error:", error);
    const errorMessage = typeof error === 'string' ? error : error?.message || "Tap payment failed";
    setError(errorMessage);
    setIsDialogOpen(false);
    if (onError) onError(error);
  }, [onError]);
  
  const openTapPayment = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to continue with payment",
        variant: "destructive",
      });
      return;
    }

    setError(null);
    setIsDialogOpen(true);
    setIsLoading(true);
    
    try {
      console.log("Initializing Tap payment for amount:", amount, currency);
      
      // Create a timeout for the request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout")), 30000);
      });

      const configPromise = supabase.functions.invoke("create-tap-session", {
        body: { amount, planName, currency }
      });

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

      console.log("Tap configuration loaded successfully");

      // Load Tap script if not already loaded
      if (!window.Tapjsli) {
        console.log("Loading Tap payment script...");
        await loadTapPaymentScript();
      }
      
      // Give some time for script to initialize
      setTimeout(() => {
        try {
          const tapAmount = currency === "KWD" ? getKWDAmount(amount) : amount;
          
          console.log("Initializing Tap payment with:", {
            amount: tapAmount,
            currency,
            container: "secure-tap-payment-container"
          });
          
          initializeTapPayment({
            containerID: "secure-tap-payment-container",
            amount: tapAmount,
            currency,
            onSuccess: (response: any) => {
              console.log("Tap payment successful:", response);
              handleSuccess(response.transaction?.id || response.id);
            },
            onError: (error: any) => {
              console.error("Tap payment error:", error);
              handleError(error);
            },
            onClose: () => {
              console.log("Tap payment closed");
              setIsDialogOpen(false);
            }
          }, config.publishableKey);
          
          setIsLoading(false);
          setRetryCount(0);
        } catch (initError) {
          console.error("Error during Tap initialization:", initError);
          handleError(initError);
          setIsLoading(false);
        }
      }, 1000);
      
    } catch (error: any) {
      console.error("Error initializing secure Tap payment:", error);
      
      // Implement exponential backoff for retries
      if (retryCount < 2 && (
        error.message?.includes('timeout') || 
        error.message?.includes('network') || 
        error.message?.includes('fetch')
      )) {
        const delay = Math.pow(2, retryCount) * 2000; // 2s, 4s, 8s
        console.log(`Retrying Tap payment initialization in ${delay}ms... (attempt ${retryCount + 1})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          setIsLoading(false);
          setIsDialogOpen(false);
          openTapPayment();
        }, delay);
      } else {
        let errorMessage = "Tap Payment is temporarily unavailable. Please try again later.";
        
        if (error.message?.includes('timeout')) {
          errorMessage = "Connection timeout. Please check your internet connection and try again.";
        } else if (error.message?.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message?.includes('configuration')) {
          errorMessage = "Payment service configuration error. Please contact support.";
        }
        
        setError(errorMessage);
        setIsLoading(false);
        setIsDialogOpen(false);
      }
    }
  };
  
  const closeDialog = () => {
    setIsDialogOpen(false);
    setError(null);
  };

  if (error) {
    return (
      <div className="w-full">
        <div className="p-4 border border-red-200 rounded-md bg-red-50">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-600 text-sm font-medium">Tap Payment Unavailable</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <Button 
            className="w-full mt-3" 
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              setRetryCount(0);
              openTapPayment();
            }}
          >
            Retry Tap Payment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button 
        className="w-full" 
        onClick={openTapPayment}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          `Pay with Tap Payment (${displayAmount} ${currency})`
        )}
      </Button>
      
      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="prompt-dialog sm:max-w-md">
          <div className="text-center mb-4">
            <h3 className="text-lg font-medium">
              {planName} Plan - {displayAmount} {currency}
            </h3>
            <p className="text-sm text-gray-500">
              Secure payment via Tap Payment
            </p>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Initializing secure payment...</span>
            </div>
          ) : (
            <div id="secure-tap-payment-container" className="min-h-[300px]"></div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
