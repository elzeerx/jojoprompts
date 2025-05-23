
import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    Tapjsli?: any;
  }
}

interface TapPaymentButtonProps {
  amount: number;
  planName: string;
  onSuccess: (paymentId: string) => void;
  onError?: (error: any) => void;
  currency?: string;
  userId?: string;
}

export function TapPaymentButton({
  amount,
  planName = "Subscription",
  onSuccess,
  onError,
  currency = "KWD",
  userId
}: TapPaymentButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSuccess = useCallback((paymentId: string) => {
    console.log("Tap payment successful:", paymentId);
    setIsDialogOpen(false);
    onSuccess(paymentId);
  }, [onSuccess]);

  const handleError = useCallback((error: any) => {
    console.error("Tap payment error:", error);
    setError("Payment failed. Please try again.");
    setIsDialogOpen(false);
    if (onError) onError(error);
  }, [onError]);
  
  const openTapPayment = async () => {
    setError(null);
    setIsDialogOpen(true);
    setIsLoading(true);
    
    try {
      // Load Tap Payment script
      if (!window.Tapjsli) {
        await loadTapPaymentScript();
      }
      
      // Add a small delay to ensure proper initialization
      setTimeout(() => {
        initializeTapPayment();
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error("Error loading Tap Payment:", error);
      setError("Failed to load payment system. Please try again.");
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
  
  const initializeTapPayment = () => {
    if (!window.Tapjsli) {
      setError("Payment system not available. Please try again.");
      return;
    }

    try {
      // Create a Tap instance with the publishable key
      const tap = window.Tapjsli("pk_test_b5JZWEaPCRy61rhY4dqMnUiw");
      
      tap.setup({
        containerID: "tap-payment-container",
        currencies: [currency],
        amount: amount,
        defaultCurrency: currency,
        uiLanguage: "en",
        onReady: () => {
          console.log("Tap payment ready");
        },
        onSuccess: (response: any) => {
          console.log("Tap payment successful:", response);
          handleSuccess(response.transaction.id);
        },
        onError: (error: any) => {
          console.error("Tap payment error:", error);
          handleError(error);
        },
        onClose: () => {
          console.log("Tap payment closed");
          setIsDialogOpen(false);
        }
      });
    } catch (error) {
      console.error("Error initializing Tap Payment:", error);
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
          `Pay with Tap Payment (${amount.toFixed(2)} ${currency})`
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
              {planName} Plan - {amount.toFixed(2)} {currency}
            </h3>
            <p className="text-sm text-gray-500">
              Secure payment via Tap Payment
            </p>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Initializing payment...</span>
            </div>
          ) : (
            <div id="tap-payment-container" className="min-h-[300px]"></div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
