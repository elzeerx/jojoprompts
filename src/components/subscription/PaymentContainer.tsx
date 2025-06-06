
import React from "react";
import { SimplePaymentSelection } from "@/components/payment/SimplePaymentSelection";

interface PaymentContainerProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
}

export function PaymentContainer({ amount, planName, onSuccess, onError }: PaymentContainerProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <SimplePaymentSelection
        amount={amount}
        planName={planName}
        onSuccess={onSuccess}
        onError={onError}
      />
    </div>
  );
}
