
import React from "react";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { PaymentProcessor } from "./PaymentProcessor";
import { useUnifiedPaymentState } from "@/hooks/useUnifiedPaymentState";

interface UnifiedPaymentManagerProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  onStart?: () => void;
}

export function UnifiedPaymentManager({
  amount,
  planName,
  onSuccess,
  onError,
  onStart
}: UnifiedPaymentManagerProps) {
  const {
    selectedMethod,
    processing,
    setSelectedMethod,
    setProcessing
  } = useUnifiedPaymentState();

  const handlePaymentStart = () => {
    setProcessing(true);
    onStart?.();
  };

  const handlePaymentSuccess = (paymentData: any) => {
    setProcessing(false);
    onSuccess(paymentData);
  };

  const handlePaymentError = (error: any) => {
    setProcessing(false);
    onError(error);
  };

  const handleBackToMethods = () => {
    setSelectedMethod(null);
    setProcessing(false);
  };

  if (!selectedMethod) {
    return (
      <PaymentMethodSelector
        onSelectMethod={setSelectedMethod}
        disabled={processing}
      />
    );
  }

  return (
    <PaymentProcessor
      method={selectedMethod}
      amount={amount}
      planName={planName}
      onSuccess={handlePaymentSuccess}
      onError={handlePaymentError}
      onStart={handlePaymentStart}
      onBack={handleBackToMethods}
    />
  );
}
