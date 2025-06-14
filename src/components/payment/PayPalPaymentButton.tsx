
import React from "react";
import { usePayPalClientId } from "./hooks/usePayPalClientId";
import { usePayPalSDK } from "./hooks/usePayPalSDK";
import { usePayPalButtons } from "./hooks/usePayPalButtons";
import { PayPalErrorDisplay } from "./components/PayPalErrorDisplay";
import { PayPalLoadingDisplay } from "./components/PayPalLoadingDisplay";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalPaymentButtonProps {
  amount: number;
  planName: string;
  planId: string;
  userId: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  disabled?: boolean;
}

export function PayPalPaymentButton({
  amount,
  planName,
  planId,
  userId,
  onSuccess,
  onError,
  disabled = false
}: PayPalPaymentButtonProps) {
  const { clientId, error: clientIdError } = usePayPalClientId();
  const { isLoading, sdkError } = usePayPalSDK(clientId, clientIdError);
  const { paypalRef, isProcessing } = usePayPalButtons({
    amount,
    planId,
    userId,
    onSuccess,
    onError,
    disabled,
    isSDKLoaded: !isLoading && !sdkError
  });

  const error = clientIdError || sdkError;

  if (error) {
    return <PayPalErrorDisplay error={error} />;
  }

  if (isLoading) {
    return <PayPalLoadingDisplay message="Setting up PayPal payment..." />;
  }

  if (isProcessing) {
    return <PayPalLoadingDisplay message="Processing your payment..." isProcessing />;
  }

  return (
    <div className="w-full">
      <div ref={paypalRef} className="min-h-[50px]" />
      <div className="text-xs text-gray-500 text-center mt-2">
        <p>🔒 Secure payment powered by PayPal</p>
      </div>
    </div>
  );
}
