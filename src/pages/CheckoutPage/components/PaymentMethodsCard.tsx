
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentGatewayManager } from "@/components/subscription/PaymentGatewayManager";

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
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <CardDescription>
          Choose your preferred payment method to complete your purchase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PaymentGatewayManager
          amount={price}
          planName={planName}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          onStart={() => {
            // Optional: can add loading state here
          }}
          useEnhanced={true} // Use the enhanced components
        />
        
        {processing && (
          <div className="text-center text-sm text-muted-foreground">
            <p>Processing your payment...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
