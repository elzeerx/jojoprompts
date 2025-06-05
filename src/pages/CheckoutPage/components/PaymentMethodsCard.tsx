
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, CreditCard, AlertTriangle } from "lucide-react";
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
  console.log("PaymentMethodsCard rendered with:", { processing, price, planName });

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" />
          Choose Payment Method
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          All payments are processed securely. Your payment information is encrypted and protected.
        </p>
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
            <p className="text-xs text-muted-foreground mb-3">
              Pay with PayPal, debit card, or credit card through PayPal's secure checkout
            </p>
            <div className="min-h-[60px]">
              <PayPalButton
                amount={price}
                planName={planName}
                onSuccess={(paymentId, details) => {
                  console.log("PayPal payment success in PaymentMethodsCard:", { paymentId, details });
                  handlePaymentSuccess({
                    paymentId,
                    paymentMethod: 'paypal',
                    details
                  });
                }}
                onError={(error) => {
                  console.error("PayPal payment error in PaymentMethodsCard:", error);
                  handlePaymentError(error);
                }}
                className="w-full"
              />
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or pay with local payment
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Tap Payments (KWD)
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Pay with your local credit card in Kuwaiti Dinar through Tap's secure payment gateway
            </p>
            <div className="min-h-[60px]">
              <SecureTapPaymentButton
                amount={price}
                planName={planName}
                onSuccess={(paymentId) => {
                  console.log("Tap payment success in PaymentMethodsCard:", { paymentId });
                  handlePaymentSuccess({
                    paymentId,
                    paymentMethod: 'tap',
                    payment_id: paymentId
                  });
                }}
                onError={(error) => {
                  console.error("Tap payment error in PaymentMethodsCard:", error);
                  handlePaymentError(error);
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-green-600" />
            <p className="text-xs font-medium text-gray-700">Secure Payment</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Your payment is secured with 256-bit SSL encryption. We never store your payment details.
          </p>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-blue-800">Having trouble?</p>
              <p className="text-xs text-blue-700 mt-1">
                If a payment method isn't working, try the other option or refresh the page. Contact support if issues persist.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
