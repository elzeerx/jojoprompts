
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, CreditCard } from "lucide-react";
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
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" />
          Payment Methods
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose your preferred payment method below
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {processing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <div className="text-center">
              <p className="font-medium">Processing payment...</p>
              <p className="text-sm text-muted-foreground">Please don't close this page</p>
            </div>
          </div>
        )}

        {/* PayPal Section */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span>PayPal</span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Recommended</span>
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            Pay with PayPal, debit card, or credit card
          </p>
          
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
          />
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* Tap Payment Section */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Tap Payments (KWD)</span>
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            Pay with your local credit card in Kuwaiti Dinar
          </p>
          
          <SecureTapPaymentButton
            amount={price}
            planName={planName}
            onSuccess={(paymentId) => {
              handlePaymentSuccess({
                paymentId,
                paymentMethod: 'tap'
              });
            }}
            onError={handlePaymentError}
          />
        </div>

        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-green-600" />
            <p className="text-xs font-medium text-gray-700">Secure Payment</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Your payment is secured with industry-standard encryption
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
