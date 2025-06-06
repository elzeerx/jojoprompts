
import React from "react";
import { SimplePaymentSelection } from "@/components/payment/SimplePaymentSelection";

interface PaymentContainerProps {
  amount: number;
  planName: string;
  planId: string;
  userId: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
}

export function PaymentContainer({ 
  amount, 
  planName, 
  planId, 
  userId, 
  onSuccess, 
  onError 
}: PaymentContainerProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <SimplePaymentSelection
        amount={amount}
        planName={planName}
        planId={planId}
        userId={userId}
        onSuccess={onSuccess}
        onError={onError}
      />
    </div>
  );
}
