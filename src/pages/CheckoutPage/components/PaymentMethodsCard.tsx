
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimplePaymentSelection } from "@/components/payment/SimplePaymentSelection";
import { CreditCard, X } from "lucide-react";
import { DiscountErrorBoundary } from "@/components/checkout/DiscountErrorBoundary";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  const handleCancelTransaction = () => {
    // Navigate away without creating any pending transaction
    navigate("/pricing");
  };
  // Calculate final amount after discount - This is the SINGLE SOURCE OF TRUTH
  const calculateFinalAmount = () => {
    if (!appliedDiscount) return price;
    
    if (appliedDiscount.discount_type === 'percentage') {
      const discountAmount = (price * appliedDiscount.discount_value) / 100;
      return Math.max(0, price - discountAmount);
    } else if (appliedDiscount.discount_type === 'fixed_amount') {
      return Math.max(0, price - appliedDiscount.discount_value);
    }
    
    return price;
  };

  const finalAmount = calculateFinalAmount();
  const discountAmount = price - finalAmount;

  console.log('=== PAYMENT METHODS CARD DEBUG ===');
  console.log('Original price:', price);
  console.log('Applied discount:', appliedDiscount);
  console.log('Final amount (after discount):', finalAmount);
  console.log('Discount amount:', discountAmount);
  console.log('===============================');

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
          {appliedDiscount ? (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span>Plan Price:</span>
                <span>${price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-green-600">
                <span>Discount ({appliedDiscount.code}):</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
              <div className="border-t pt-1">
                <div className="flex justify-between items-center font-semibold">
                  <span>Total:</span>
                  <span className={finalAmount === 0 ? 'text-green-600' : ''}>
                    {finalAmount === 0 ? 'FREE!' : `$${finalAmount.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-blue-800 text-center">
              Total: <strong>${price.toFixed(2)}</strong>
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <DiscountErrorBoundary>
          <SimplePaymentSelection
            amount={finalAmount} // Final amount after discount - NO FURTHER DISCOUNT CALCULATION NEEDED
            planName={planName}
            planId={planId}
            userId={userId}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            appliedDiscount={appliedDiscount} // Pass discount info for tracking only
          />
        </DiscountErrorBoundary>
        
        {/* Cancel Transaction Button */}
        <div className="mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancelTransaction}
            disabled={processing}
            className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel Transaction
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
