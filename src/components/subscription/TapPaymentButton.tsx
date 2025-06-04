
import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTapPaymentScript } from "./hooks/useTapPaymentScript";
import { usePaymentConversion } from "./hooks/usePaymentConversion";
import { useTapPaymentInitialization } from "./hooks/useTapPaymentInitialization";
import { TapPaymentDialog } from "./components/TapPaymentDialog";

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
  
  const { loadTapPaymentScript } = useTapPaymentScript();
  const { getKWDAmount } = usePaymentConversion();
  const { initializeTapPayment } = useTapPaymentInitialization();
  
  const displayAmount = currency === "KWD" ? getKWDAmount(amount).toFixed(2) : amount.toFixed(2);
  const containerID = "tap-payment-container";
  
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
        const tapAmount = currency === "KWD" ? getKWDAmount(amount) : amount;
        
        // Use a test publishable key - this should be fetched from your backend in production
        const publishableKey = "pk_test_b5JZWEaPCRy61rhY4dqMnUiw";
        
        initializeTapPayment({
          containerID,
          amount: tapAmount,
          currency,
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
        }, publishableKey);
        
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
      
      <TapPaymentDialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
        planName={planName}
        displayAmount={displayAmount}
        currency={currency}
        isLoading={isLoading}
        containerID={containerID}
      />
    </>
  );
}
