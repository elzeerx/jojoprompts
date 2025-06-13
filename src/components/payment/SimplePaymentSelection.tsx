
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayPalPaymentButton } from "./PayPalPaymentButton";
import { Shield, DollarSign, AlertCircle } from "lucide-react";

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
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePaymentSuccess = (paymentData: any) => {
    console.log('Payment success in SimplePaymentSelection:', paymentData);
    setProcessing(true);
    setError(null);
    onSuccess(paymentData);
  };

  const handlePaymentError = (error: any) => {
    console.error('Payment error in SimplePaymentSelection:', error);
    setProcessing(false);
    setError(error?.message || 'Payment failed');
    onError(error);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" />
          Secure Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Summary */}
        <div className="p-4 bg-gray-50 rounded-lg border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Plan:</span>
            <span className="font-medium">{planName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total:</span>
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-xl font-bold text-green-600">{amount}</span>
              <span className="text-sm text-gray-600">USD</span>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Payment Error</p>
                <p>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Method */}
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Pay with PayPal</h3>
            <p className="text-sm text-gray-600 mb-4">
              Secure payment processing powered by PayPal
            </p>
          </div>

          <PayPalPaymentButton
            amount={amount}
            planName={planName}
            planId={planId}
            userId={userId}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            disabled={processing}
          />
        </div>

        {/* Security Notice */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-medium mb-1">Secure Payment</p>
            <p>Your payment is processed securely through PayPal with industry-standard encryption and buyer protection.</p>
          </div>
        </div>

        {processing && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 text-center">
              Processing your payment and activating your subscription...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
