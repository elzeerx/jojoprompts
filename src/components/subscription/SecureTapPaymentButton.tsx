
import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, AlertCircle } from "lucide-react";
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
  const [retryCount, setRetryCount] = useState(0);
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
      console.log("Initializing Tap payment...");
      
      const { data: config, error: configError } = await supabase.functions.invoke(
        "create-tap-session",
        {
          body: { amount, planName, currency }
        }
      );

      if (configError) {
        console.error("Config error:", configError);
        throw new Error(`Tap configuration error: ${configError.message || 'Failed to initialize payment'}`);
      }

      if (!config) {
        throw new Error("Failed to get payment configuration");
      }

      console.log("Tap config loaded successfully");

      if (!window.Tapjsli) {
        await loadTapPaymentScript();
      }
      
      setTimeout(() => {
        try {
          initializeTapPayment(config);
          setIsLoading(false);
          setRetryCount(0);
        } catch (initError) {
          console.error("Error during Tap initialization:", initError);
          handleError(initError);
          setIsLoading(false);
        }
      }, 500);
    } catch (error: any) {
      console.error("Error initializing secure Tap payment:", error);
      
      if (retryCount < 2 && (error.message?.includes('network') || error.message?.includes('timeout'))) {
        console.log(`Retrying Tap payment initialization... (attempt ${retryCount + 1})`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => {
          setIsLoading(false);
          setIsDialogOpen(false);
          openTapPayment();
        }, 2000 * (retryCount + 1));
      } else {
        const errorMessage = error.message?.includes('network') 
          ? "Network error. Please check your connection and try again."
          : "Tap Payment is temporarily unavailable. Please try again later or use PayPal.";
        setError(errorMessage);
        setIsLoading(false);
        setIsDialogOpen(false);
      }
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
      script.onload = () => {
        console.log("Tap Payment script loaded successfully");
        resolve();
      };
      script.onerror = () => {
        console.error("Failed to load Tap Payment script");
        reject(new Error("Failed to load Tap Payment script"));
      };
      document.head.appendChild(script);
    });
  };
  
  const initializeTapPayment = (config: any) => {
    if (!window.Tapjsli) {
      throw new Error("Tap Payment system not available");
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
      throw new Error("Failed to initialize payment system");
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
