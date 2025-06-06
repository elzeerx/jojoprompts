
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayPalPaymentButton } from "./PayPalPaymentButton";
import { TapPaymentButton } from "./TapPaymentButton";

interface SimplePaymentSelectionProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
}

export function SimplePaymentSelection({
  amount,
  planName,
  onSuccess,
  onError
}: SimplePaymentSelectionProps) {
  const [processing, setProcessing] = useState(false);

  const handlePaymentSuccess = (paymentData: any) => {
    setProcessing(true);
    onSuccess(paymentData);
  };

  const handlePaymentError = (error: any) => {
    setProcessing(false);
    onError(error);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Payment Method</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Plan: {planName}</p>
          <p className="text-lg font-semibold">${amount} USD</p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">PayPal</h3>
            <PayPalPaymentButton
              amount={amount}
              planName={planName}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              disabled={processing}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Tap Payment</h3>
            <TapPaymentButton
              amount={amount}
              planName={planName}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
              disabled={processing}
            />
          </div>
        </div>

        {processing && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Processing your payment and setting up your subscription...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
