
import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Percent, X } from "lucide-react";
import { DiscountCodeInput } from "@/components/checkout/DiscountCodeInput";
import { Button } from "@/components/ui/button";
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface PlanSummaryCardProps {
  selectedPlan: {
    id: string;
    name: string;
    description?: string;
  };
  price: number;
  features: string[];
  isLifetime: boolean;
  appliedDiscount?: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  } | null;
  onDiscountApplied: (discount: {
    id: string;
    code: string;
    discount_type: string;
    discount_value: number;
  }) => void;
  onDiscountRemoved: () => void;
  processing: boolean;
}

export function PlanSummaryCard({
  selectedPlan,
  price,
  features,
  isLifetime,
  appliedDiscount,
  onDiscountApplied,
  onDiscountRemoved,
  processing
}: PlanSummaryCardProps) {
  const { t, isRTL } = useTranslation();
  const originalPrice = price;
  
  // Calculate discount locally for display purposes only
  const calculateFinalAmount = () => {
    if (!appliedDiscount) return originalPrice;
    
    if (appliedDiscount.discount_type === 'percentage') {
      const discountAmount = (originalPrice * appliedDiscount.discount_value) / 100;
      return Math.max(0, originalPrice - discountAmount);
    } else if (appliedDiscount.discount_type === 'fixed_amount') {
      return Math.max(0, originalPrice - appliedDiscount.discount_value);
    }
    
    return originalPrice;
  };

  const finalPrice = calculateFinalAmount();
  const discountAmount = originalPrice - finalPrice;

  return (
    <Card className="border-warm-gold/30 bg-gradient-to-br from-white/80 to-warm-gold/5 p-6">
      <div className="space-y-6">
        {/* Plan Header */}
        <div className="text-center">
          <h3 className={cn("text-xl font-semibold text-dark-base mb-2", isRTL && "rtl-text")}>
            {selectedPlan.name}
          </h3>
          <p className={cn("text-muted-foreground text-sm", isRTL && "rtl-text")}>
            {selectedPlan.description || (isLifetime ? t('checkout.lifetimeAccess') : t('checkout.yearAccess'))}
          </p>
        </div>

        {/* Pricing Section */}
        <div className="space-y-4">
          <div className="text-center">
            {appliedDiscount && discountAmount > 0 ? (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground line-through">
                  ${originalPrice.toFixed(2)}
                </div>
                <div className="text-3xl font-bold text-dark-base">
                  ${finalPrice.toFixed(2)}
                </div>
                <div className={cn("flex items-center justify-center gap-2 text-green-600 text-sm font-medium", isRTL && "flex-row-reverse")}>
                  <Percent className="h-4 w-4" />
                  <span className={isRTL ? "rtl-text" : ""}>{t('checkout.youSave')} ${discountAmount.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="text-3xl font-bold text-dark-base">
                ${originalPrice.toFixed(2)}
              </div>
            )}
            <p className={cn("text-sm text-muted-foreground mt-1", isRTL && "rtl-text")}>
              {isLifetime ? t('checkout.oneTimePayment') : t('checkout.annualSubscription')}
            </p>
          </div>

          {/* Discount Code Input */}
          <DiscountCodeInput
            onDiscountApplied={onDiscountApplied}
            onDiscountRemoved={onDiscountRemoved}
            appliedDiscount={appliedDiscount}
            disabled={processing}
            planId={selectedPlan.id}
          />
        </div>

        {/* Features List */}
        {features && features.length > 0 && (
          <div className="space-y-3">
            <h4 className={cn("font-medium text-dark-base", isRTL && "rtl-text text-right")}>{t('checkout.whatsIncluded')}</h4>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className={cn("flex items-start gap-2 text-sm", isRTL && "flex-row-reverse")}>
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className={isRTL ? "rtl-text text-right" : ""}>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Lifetime Badge */}
        {isLifetime && (
          <div className="text-center">
            <Badge variant="secondary" className="bg-warm-gold/20 text-warm-gold border-warm-gold/30">
              {t('checkout.lifetimeAccess')}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}
