
import React from "react";
import { Loader2 } from "lucide-react";
import { usePayPalPayment } from "@/hooks/usePayPalPayment";
import { PayPalPaymentError } from "./PayPalPaymentError";

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalPaymentProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  onStart?: () => void;
  onUnavailable?: (reason: string) => void;
}

export function PayPalPayment(props: PayPalPaymentProps) {
  const {
    paypalRef,
    loading,
    error,
    retryCount,
    maxRetries,
    handleRetry
  } = usePayPalPayment(props);

  if (loading) {
    return (
      <div className="w-full h-12 flex items-center justify-center border rounded-lg bg-gray-50">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm">Loading PayPal...</span>
      </div>
    );
  }

  if (error) {
    return (
      <PayPalPaymentError
        error={error}
        retryCount={retryCount}
        maxRetries={maxRetries}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="w-full">
      <div ref={paypalRef} className="w-full min-h-[45px]" />
    </div>
  );
}
