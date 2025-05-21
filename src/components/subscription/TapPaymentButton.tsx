
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Tapjsli?: any;
  }
}

interface TapPaymentButtonProps {
  amount: number;
  currency: string;
  planName: string;
  onSuccess: (paymentId: string, details: any) => void;
  onError: (error: any) => void;
  testMode?: boolean;
}

export function TapPaymentButton({
  amount,
  currency,
  planName,
  onSuccess,
  onError,
  testMode = false
}: TapPaymentButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tapInstance, setTapInstance] = useState<any>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);
  
  // Handle test mode simulation
  const handleTestPayment = () => {
    console.log("Test Tap payment initiated", { amount, currency, planName });
    const mockPaymentId = `TEST-TAP-${Date.now()}`;
    const mockDetails = {
      id: mockPaymentId,
      status: "CAPTURED",
      amount: amount,
      currency: currency,
      customer: { email: "test@example.com" },
      transaction: { created: new Date().toISOString() },
    };
    
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      console.log("Test Tap payment completed", mockDetails);
      onSuccess(mockPaymentId, mockDetails);
    }, 1500);
  };
  
  const openTapPayment = async () => {
    if (testMode) {
      handleTestPayment();
      return;
    }
    
    setIsDialogOpen(true);
    setIsLoading(true);
    setScriptError(null);
    
    try {
      // Load Tap Payment script if not already loaded
      if (!window.Tapjsli) {
        console.log("Loading Tap Payment script");
        await loadTapPaymentScript();
      } else {
        console.log("Tap Payment script already loaded");
      }
      
      // Give the script a moment to initialize properly
      setTimeout(() => {
        try {
          console.log("Initializing Tap Payment...");
          initializeTapPayment();
          setIsLoading(false);
        } catch (initError) {
          console.error("Error during Tap Payment initialization", initError);
          setScriptError("Failed to initialize payment form. Please try again later.");
          setIsLoading(false);
        }
      }, 1000);
    } catch (error) {
      console.error("Error loading Tap Payment:", error);
      setScriptError("Failed to load payment service. Please try again later.");
      setIsLoading(false);
      onError(error);
    }
  };
  
  const loadTapPaymentScript = () => {
    console.log("Starting Tap Payment script load");
    return new Promise<void>((resolve, reject) => {
      const scriptId = "tap-payment-sdk";
      let existingScript = document.getElementById(scriptId) as HTMLScriptElement;
      
      if (existingScript) {
        console.log("Tap Payment script already exists in DOM");
        resolve();
        return;
      }
      
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://secure.tap.company/checkout/js/setup-v2.js";
      script.async = true;
      
      script.onload = () => {
        console.log("Tap Payment script loaded successfully");
        resolve();
      };
      
      script.onerror = (e) => {
        console.error("Failed to load Tap Payment script", e);
        reject(new Error("Failed to load Tap Payment script"));
      };
      
      document.body.appendChild(script);
    });
  };
  
  const initializeTapPayment = () => {
    if (window.Tapjsli) {
      try {
        console.log("Creating Tap instance with test publishable key");
        // Create a Tap instance with the publishable key
        const tap = window.Tapjsli("pk_test_b5JZWEaPCRy61rhY4dqMnUiw");
        
        console.log("Setting up Tap Payment with options:", { 
          containerID: "tap-payment-container",
          amount,
          currency
        });
        
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
            onSuccess(response.transaction.id, response);
          },
          onError: (error: any) => {
            console.error("Payment error:", error);
            setIsDialogOpen(false);
            onError(error);
            toast({
              title: "Payment Failed",
              description: "There was a problem processing your payment. Please try again.",
              variant: "destructive"
            });
          },
          onClose: () => {
            console.log("Payment closed");
            setIsDialogOpen(false);
          }
        });
        
        setTapInstance(tap);
      } catch (error) {
        console.error("Error initializing Tap Payment:", error);
        setScriptError("Failed to initialize Tap Payment.");
        onError(error);
      }
    } else {
      console.error("Tap Payment SDK not available");
      setScriptError("Payment service not available. Please try again later.");
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (tapInstance) {
        // Any cleanup if needed for tap instance
      }
    };
  }, [tapInstance]);
  
  const closeDialog = () => {
    setIsDialogOpen(false);
    if (tapInstance) {
      // Clean up Tap instance if needed
      console.log("Closing Tap payment dialog");
    }
  };

  if (testMode) {
    return (
      <Button className="w-full bg-teal-500 hover:bg-teal-600" onClick={handleTestPayment} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing Test Payment...
          </>
        ) : (
          `Test Tap Payment (${amount.toFixed(2)} ${currency})`
        )}
      </Button>
    );
  }

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
            <div className="flex flex-col items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-center">Initializing payment form...</p>
            </div>
          ) : scriptError ? (
            <div className="text-center p-4">
              <p className="text-red-500 mb-4">{scriptError}</p>
              <Button variant="outline" onClick={() => { setScriptError(null); openTapPayment(); }}>
                Try Again
              </Button>
            </div>
          ) : (
            <div id="tap-payment-container" className="min-h-[300px]"></div>
          )}
          
          <div className="text-center text-sm text-gray-500 mt-4">
            <p>For testing purposes only. No actual payment will be processed.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
