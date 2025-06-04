
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { PayPalButton } from "@/components/subscription/PayPalButton";
import { SecureTapPaymentButton } from "@/components/subscription/SecureTapPaymentButton";

interface PaymentMethodsCardProps {
  processing: boolean;
  price: number;
  planName: string;
  handlePaymentSuccess: (paymentData: any) => void;
  handlePaymentError: (error: any) => void;
}

export function PaymentMethodsCard({
  processing,
  price,
  planName,
  handlePaymentSuccess,
  handlePaymentError
}: PaymentMethodsCardProps) {
  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle>Choose Payment Method</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {processing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="font-medium">Processing payment...</p>
              <p className="text-sm text-muted-foreground">Please don't close this page</p>
            </div>
          </div>
        )}
        
        <div className="space-y-6">
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <span>PayPal</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Recommended</span>
            </h4>
            <PayPalButton
              amount={price}
              planName={planName}
              onSuccess={(paymentId, details) => {
                handlePaymentSuccess({
                  paymentId,
                  paymentMethod: 'paypal',
                  details
                });
              }}
              onError={handlePaymentError}
              className="w-full"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or pay with card
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Credit Card (Tap Payments)</h4>
            <SecureTapPaymentButton
              amount={price}
              planName={planName}
              onSuccess={(paymentId) => {
                handlePaymentSuccess({
                  paymentId,
                  paymentMethod: 'tap',
                  payment_id: paymentId
                });
              }}
              onError={handlePaymentError}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
