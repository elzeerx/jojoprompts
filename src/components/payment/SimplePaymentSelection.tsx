import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SimplePayPalButton } from "./SimplePayPalButton";
import { SimpleUpayButton } from "./SimpleUpayButton";
import { PaymentGatewaySelector, PaymentGateway } from "./PaymentGatewaySelector";
import { useGeoDetection } from "@/hooks/useGeoDetection";
import { calculateDiscountedKWD, getKWDPrice } from "@/utils/currencyUtils";

interface SimplePaymentSelectionProps {
  amount: number;
  planName: string;
  planId: string;
  userId: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  appliedDiscount?: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  } | null;
}

export function SimplePaymentSelection({
  amount,
  planName,
  planId,
  userId,
  onSuccess,
  onError,
  appliedDiscount
}: SimplePaymentSelectionProps) {
  const { isGCC, loading: geoLoading } = useGeoDetection();
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('paypal');

  // Set default gateway based on geo-detection
  useEffect(() => {
    if (!geoLoading) {
      setSelectedGateway(isGCC ? 'upayments' : 'paypal');
    }
  }, [isGCC, geoLoading]);

  // Calculate KWD price with discount
  const originalKWD = getKWDPrice(amount);
  const discountedKWD = appliedDiscount 
    ? calculateDiscountedKWD(amount, appliedDiscount)
    : originalKWD;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Payment</CardTitle>
        <CardDescription>
          Choose your preferred payment method for the {planName} plan
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gateway Selector - shows both options with recommendation */}
        <PaymentGatewaySelector
          selectedGateway={selectedGateway}
          onGatewayChange={setSelectedGateway}
          usdPrice={amount}
          kwdPrice={discountedKWD}
          isGCC={isGCC}
        />

        {/* Payment Button based on selection */}
        {selectedGateway === 'paypal' ? (
          <SimplePayPalButton
            amount={amount}
            planId={planId}
            userId={userId}
            onSuccess={onSuccess}
            onError={onError}
            appliedDiscount={appliedDiscount}
          />
        ) : (
          <SimpleUpayButton
            amountKWD={discountedKWD}
            amountUSD={amount}
            planId={planId}
            userId={userId}
            onSuccess={onSuccess}
            onError={onError}
            appliedDiscount={appliedDiscount}
          />
        )}
      </CardContent>
    </Card>
  );
}
