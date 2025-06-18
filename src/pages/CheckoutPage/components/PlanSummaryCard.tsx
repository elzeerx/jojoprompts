
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Check } from "lucide-react";
import { DiscountCodeInput } from "@/components/checkout/DiscountCodeInput";

interface PlanSummaryCardProps {
  selectedPlan: any;
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
  calculateDiscountedPrice: (price: number) => number;
  getDiscountAmount: (price: number) => number;
  processing?: boolean;
}

export function PlanSummaryCard({ 
  selectedPlan, 
  price, 
  features, 
  isLifetime,
  appliedDiscount,
  onDiscountApplied,
  onDiscountRemoved,
  calculateDiscountedPrice,
  getDiscountAmount,
  processing = false
}: PlanSummaryCardProps) {
  const discountAmount = getDiscountAmount(price);
  const finalPrice = calculateDiscountedPrice(price);

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-warm-gold" />
          {selectedPlan.name} Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="space-y-2">
            {appliedDiscount && discountAmount > 0 && (
              <div className="text-lg text-muted-foreground line-through">
                ${price.toFixed(2)}
              </div>
            )}
            <div className="text-3xl font-bold text-warm-gold">
              ${finalPrice.toFixed(2)}
              {isLifetime ? (
                <span className="text-lg text-muted-foreground"> one-time</span>
              ) : (
                <span className="text-lg text-muted-foreground"> for 1 year</span>
              )}
            </div>
            {appliedDiscount && discountAmount > 0 && (
              <div className="text-sm text-green-600 font-medium">
                You save ${discountAmount.toFixed(2)}!
              </div>
            )}
          </div>
          <p className="text-muted-foreground mt-2">
            {selectedPlan.description}
          </p>
          {!isLifetime && (
            <p className="text-sm text-amber-600 mt-2 font-medium">
              One-time payment • Access expires after 1 year
            </p>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">Included Features:</h4>
          <ul className="space-y-1">
            {features.map((feature: string, index: number) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-4 border-t">
          <DiscountCodeInput
            onDiscountApplied={onDiscountApplied}
            onDiscountRemoved={onDiscountRemoved}
            appliedDiscount={appliedDiscount}
            disabled={processing}
          />
        </div>
      </CardContent>
    </Card>
  );
}
