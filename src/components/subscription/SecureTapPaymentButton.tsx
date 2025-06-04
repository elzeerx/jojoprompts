
import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

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
  const { user } = useAuth();
  
  const getKWDAmount = (usdAmount: number) => {
    const conversionRates: { [key: number]: number } = {
      55: 15,
      65: 20,
      80: 25,
      100: 30
    };
    return conversionRates[usdAmount] || (usdAmount * 0.3);
  };
  
  const displayAmount = currency === "KWD" ? getKWDAmount(amount).toFixed(2) : amount.toFixed(2);
  
  const handleSuccess = useCallback((paymentId: string) => {
    console.log("Secure Tap payment successful:", paymentId);
    setIsDialogOpen(false);
    onSuccess(paymentId);
  }, [onSuccess]);

  const handleError = useCallback((error: any) => {
    console.error("Secure Tap payment error:", error);
    setError("Payment failed. Please try again.");
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
      // Get secure configuration from edge function
      const { data: config, error: configError } = await supabase.functions.invoke(
        "create-tap-session",
        {
          body: { amount, planName, currency }
        }
      );

      if (configError || !config) {
        throw new Error(configError?.message || "Failed to initialize payment");
      }

      // Load Tap Payment script if not already loaded
      if (!window.Tapjsli) {
        await loadTapPaymentScript();
      }
      
      setTimeout(() => {
        initializeTapPayment(config);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error("Error initializing secure Tap payment:", error);
      setError("Failed to initialize payment. Please try again.");
      handleError(error);
      setIsLoading(false);
      setIsDialogOpen(false);
    }
  };
  
  const loadTapPaymentScript = () => {
    return new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector('script[src*="tap.company"]');
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://secure.tap.company/checkout/js/setup-v2.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Tap Payment script"));
      document.head.appendChild(script);
    });
  };
  
  const initializeTapPayment = (config: any) => {
    if (!window.Tapjsli) {
      setError("Payment system not available. Please try again.");
      return;
    }

    try {
      const tap = window.Tapjsli(config.publishableKey);
      
      tap.setup({
        containerID: "secure-tap-payment-container",
        currencies: [config.currency],
        amount: config.amount,
        defaultCurrency: config.currency,
        uiLanguage: "en",
        onReady: () => {
          console.log("Secure Tap payment ready");
        },
        onSuccess: (response: any) => {
          console.log("Secure Tap payment successful:", response);
          handleSuccess(response.transaction.id);
        },
        onError: (error: any) => {
          console.error("Secure Tap payment error:", error);
          handleError(error);
        },
        onClose: () => {
          console.log("Secure Tap payment closed");
          setIsDialogOpen(false);
        }
      });
    } catch (error) {
      console.error("Error initializing secure Tap payment:", error);
      setError("Failed to initialize payment. Please try again.");
      handleError(error);
    }
  };
  
  const closeDialog = () => {
    setIsDialogOpen(false);
    setError(null);
  };

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
      
      {error && (
        <div className="mt-2 p-2 border border-red-200 rounded bg-red-50">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      
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
