
import React, { useState } from "react";
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
  planName,
  onSuccess,
  onError,
  currency = "KWD",
  userId
}: TapPaymentButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tapInstance, setTapInstance] = useState<any>(null);
  
  const openTapPayment = async () => {
    setIsDialogOpen(true);
    setIsLoading(true);
    
    try {
      // Load Tap Payment script
      if (!window.Tapjsli) {
        await loadTapPaymentScript();
      }
      
      setTimeout(() => {
        initializeTapPayment();
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Error loading Tap Payment:", error);
      if (onError) onError(error);
      setIsLoading(false);
      setIsDialogOpen(false);
    }
  };
  
  const loadTapPaymentScript = () => {
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://secure.tap.company/checkout/js/setup-v2.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Tap Payment script"));
      document.body.appendChild(script);
    });
  };
  
  const initializeTapPayment = () => {
    if (window.Tapjsli) {
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
            console.log("Payment successful:", response);
            setIsDialogOpen(false);
            onSuccess(response.transaction.id);
          },
          onError: (error: any) => {
            console.error("Payment error:", error);
            setIsDialogOpen(false);
            if (onError) onError(error);
          },
          onClose: () => {
            console.log("Payment closed");
            setIsDialogOpen(false);
          }
        });
        
        setTapInstance(tap);
      } catch (error) {
        console.error("Error initializing Tap Payment:", error);
        if (onError) onError(error);
      }
    }
  };
  
  const closeDialog = () => {
    setIsDialogOpen(false);
    if (tapInstance) {
      // Clean up Tap instance if needed
    }
  };

  return (
    <>
      <Button className="w-full" onClick={openTapPayment}>
        Pay with Tap Payment ({amount.toFixed(2)} {currency})
      </Button>
      
      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
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
            </div>
          ) : (
            <div id="tap-payment-container" className="min-h-[300px]"></div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
