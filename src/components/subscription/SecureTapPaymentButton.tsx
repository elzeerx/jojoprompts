
import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { usePaymentConversion } from "./hooks/usePaymentConversion";
import { useTapPaymentDialog } from "./hooks/useTapPaymentDialog";
import { useTapPaymentFlow } from "./hooks/useTapPaymentFlow";
import { TapPaymentErrorDisplay } from "./components/TapPaymentErrorDisplay";
import { TapPaymentLoadingDisplay } from "./components/TapPaymentLoadingDisplay";

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
  const { getKWDAmount } = usePaymentConversion();
  const { isDialogOpen, openDialog, closeDialog } = useTapPaymentDialog();
  
  const { isLoading, error, initializePayment, resetError } = useTapPaymentFlow({
    amount,
    planName,
    onSuccess: (paymentId) => {
      closeDialog();
      onSuccess(paymentId);
    },
    onError: (error) => {
      closeDialog();
      if (onError) onError(error);
    },
    currency
  });
  
  const displayAmount = currency === "KWD" ? getKWDAmount(amount).toFixed(2) : amount.toFixed(2);
  
  const handleButtonClick = () => {
    openDialog();
    initializePayment();
  };

  const handleRetry = () => {
    resetError();
    initializePayment();
  };

  if (error) {
    return (
      <TapPaymentErrorDisplay 
        error={error} 
        onRetry={handleRetry}
      />
    );
  }

  return (
    <>
      <Button 
        className="w-full" 
        onClick={handleButtonClick}
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
            <TapPaymentLoadingDisplay />
          ) : (
            <div id="secure-tap-payment-container" className="min-h-[300px]"></div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
