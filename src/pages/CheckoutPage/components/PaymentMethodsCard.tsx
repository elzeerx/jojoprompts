
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SimplePaymentSelection } from "@/components/payment/SimplePaymentSelection";
import { CreditCard, X } from "lucide-react";
import { DiscountErrorBoundary } from "@/components/checkout/DiscountErrorBoundary";
import { useNavigate } from "react-router-dom";
import { createLogger } from '@/utils/logging';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { EnhancedTrustBadges } from "@/components/checkout/EnhancedTrustBadges";
import { MoneyBackGuarantee } from "@/components/checkout/MoneyBackGuarantee";

const logger = createLogger('PAYMENT_METHODS_CARD');

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
  const { t, isRTL } = useTranslation();

  const handleCancelTransaction = () => {
    navigate("/pricing");
  };

  // Calculate final amount after discount
  const calculateFinalAmount = () => {
    if (!appliedDiscount) return price;
    
    if (appliedDiscount.discount_type === 'percentage') {
      const discountAmount = (price * appliedDiscount.discount_value) / 100;
      const result = Math.max(0, price - discountAmount);
      return Math.round(result * 100) / 100;
    } else if (appliedDiscount.discount_type === 'fixed_amount') {
      const result = Math.max(0, price - appliedDiscount.discount_value);
      return Math.round(result * 100) / 100;
    }
    
    return price;
  };

  const finalAmount = calculateFinalAmount();
  const discountAmount = price - finalAmount;

  logger.debug('Payment calculation', { 
    originalPrice: price, 
    appliedDiscount, 
    finalAmount, 
    discountAmount 
  });

  return (
    <Card className="w-full">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-3">
          <div className="rounded-full bg-warm-gold/10 p-3">
            <CreditCard className="h-6 w-6 text-warm-gold" />
          </div>
        </div>
        <CardTitle className={cn("text-xl", isRTL && "rtl-text")}>{t('checkout.paymentMethodTitle')}</CardTitle>
        <div className="bg-blue-50 border border-blue-100 rounded-md p-3 mt-3">
          {appliedDiscount ? (
            <div className="space-y-1">
              <div className={cn("flex justify-between items-center text-sm", isRTL && "flex-row-reverse")}>
                <span className={isRTL ? "rtl-text" : ""}>{t('checkout.planPrice')}</span>
                <span>${price.toFixed(2)}</span>
              </div>
              <div className={cn("flex justify-between items-center text-sm text-green-600", isRTL && "flex-row-reverse")}>
                <span className={isRTL ? "rtl-text" : ""}>{t('checkout.discount')} ({appliedDiscount.code}):</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
              <div className="border-t pt-1">
                <div className={cn("flex justify-between items-center font-semibold", isRTL && "flex-row-reverse")}>
                  <span className={isRTL ? "rtl-text" : ""}>{t('checkout.total')}</span>
                  <span className={finalAmount === 0 ? 'text-green-600' : ''}>
                    {finalAmount === 0 ? t('checkout.free') : `$${finalAmount.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className={cn("text-sm text-blue-800 text-center", isRTL && "rtl-text")}>
              {t('checkout.total')} <strong>${price.toFixed(2)}</strong>
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <DiscountErrorBoundary>
          <SimplePaymentSelection
            amount={finalAmount}
            planName={planName}
            planId={planId}
            userId={userId}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
            appliedDiscount={appliedDiscount}
          />
        </DiscountErrorBoundary>
        
        {/* Trust Elements */}
        <div className="mt-4 space-y-3">
          <MoneyBackGuarantee variant="compact" />
          <EnhancedTrustBadges variant="compact" />
        </div>
        
        {/* Cancel Transaction Button */}
        <div className="mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancelTransaction}
            disabled={processing}
            className={cn(
              "w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300",
              isRTL && "flex-row-reverse"
            )}
          >
            <X className={cn("h-4 w-4", isRTL ? "ml-2" : "mr-2")} />
            <span className={isRTL ? "rtl-text" : ""}>{t('checkout.cancelTransaction')}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
