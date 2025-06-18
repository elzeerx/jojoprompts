
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimplePaymentSelection } from "@/components/payment/SimplePaymentSelection";
import { CreditCard } from "lucide-react";

interface PaymentMethodsCardProps {
  processing: boolean;
  price: number;
  planName: string;
  planId: string;
  userId: string;
  handlePaymentSuccess: (paymentData: any) => void;
  handlePaymentError: (error: any) => void;
  appliedDiscount?: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  } | null;
}

export function PaymentMethodsCard({
  processing,
  price,
  planName,
  planId,
  userId,
  handlePaymentSuccess,
  handlePaymentError,
  appliedDiscount
}: PaymentMethodsCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <div className="rounded-full bg-warm-gold/10 p-3">
            <CreditCard className="h-6 w-6 text-warm-gold" />
          </div>
        </div>
        <CardTitle className="text-xl">Payment Method</CardTitle>
        <div className="bg-blue-50 border border-blue-100 rounded-md p-3 mt-3">
          <p className="text-sm text-blue-800 text-center">
            Total: <strong>${price.toFixed(2)}</strong>
            {appliedDiscount && (
              <span className="block text-green-600 text-xs mt-1">
                Discount applied: {appliedDiscount.code}
              </span>
            )}
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <SimplePaymentSelection
          amount={price}
          planName={planName}
          planId={planId}
          userId={userId}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          appliedDiscount={appliedDiscount}
        />
      </CardContent>
    </Card>
  );
}
