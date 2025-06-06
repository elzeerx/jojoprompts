
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { PaymentContainer } from "@/components/subscription/PaymentContainer";

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

        <PaymentContainer
          amount={price}
          planName={planName}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
        />
      </CardContent>
    </Card>
  );
}
