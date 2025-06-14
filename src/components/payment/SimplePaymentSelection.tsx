
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
}

export function SimplePaymentSelection({
  amount,
  planName,
  planId,
  userId,
  onSuccess,
  onError
}: SimplePaymentSelectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Payment</CardTitle>
        <CardDescription>
          Choose your preferred payment method for the {planName} plan (${amount})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SimplePayPalButton
          amount={amount}
          planId={planId}
          userId={userId}
          onSuccess={onSuccess}
          onError={onError}
        />
      </CardContent>
    </Card>
  );
}
