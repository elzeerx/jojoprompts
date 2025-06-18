
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SimplePayPalButton } from "./SimplePayPalButton";

interface SimplePaymentSelectionProps {
  amount: number;
  planName: string;
  planId: string;
  userId: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  appliedDiscount?: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  } | null;
}

export function SimplePaymentSelection({
  amount,
  planName,
  planId,
  userId,
  onSuccess,
  onError,
  appliedDiscount
}: SimplePaymentSelectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Payment</CardTitle>
        <CardDescription>
          Choose your preferred payment method for the {planName} plan (${amount.toFixed(2)})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SimplePayPalButton
          amount={amount}
          planId={planId}
          userId={userId}
          onSuccess={onSuccess}
          onError={onError}
          appliedDiscount={appliedDiscount}
        />
      </CardContent>
    </Card>
  );
}
