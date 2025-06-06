
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { PayPalPayment } from "./PayPalPayment";
import { TapPayment } from "./TapPayment";

interface PaymentContainerProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
}

export function PaymentContainer({ amount, planName, onSuccess, onError }: PaymentContainerProps) {
  const [processingMethod, setProcessingMethod] = useState<string | null>(null);

  const handlePaymentSuccess = (paymentData: any) => {
    console.log('Payment success in container:', paymentData);
    setProcessingMethod(null);
    onSuccess(paymentData);
  };

  const handlePaymentError = (error: any) => {
    console.error('Payment error in container:', error);
    setProcessingMethod(null);
    onError(error);
  };

  const handlePaymentStart = (method: string) => {
    setProcessingMethod(method);
  };

  return (
    <div className="space-y-6">
      {/* PayPal Section */}
      <Card className="relative">
        <CardContent className="p-6">
          <div className="mb-4">
            <h4 className="font-medium flex items-center gap-2">
              <span>PayPal</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Recommended</span>
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Pay with PayPal, debit card, or credit card
            </p>
          </div>
          
          {processingMethod && processingMethod !== 'paypal' && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Another payment method is processing...
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <PayPalPayment
            amount={amount}
            planName={planName}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </CardContent>
      </Card>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* Tap Payment Section */}
      <Card className="relative">
        <CardContent className="p-6">
          <div className="mb-4">
            <h4 className="font-medium">Tap Payments (KWD)</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Pay with your local credit card in Kuwaiti Dinar
            </p>
          </div>
          
          {processingMethod && processingMethod !== 'tap' && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Another payment method is processing...
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <TapPayment
            amount={amount}
            planName={planName}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </CardContent>
      </Card>

      {/* Security Notice */}
      <div className="mt-6 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <p className="text-xs font-medium text-gray-700">Secure Payment</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Your payment is secured with industry-standard encryption. Both payment methods are processed through secure, certified payment gateways.
        </p>
      </div>
    </div>
  );
}
