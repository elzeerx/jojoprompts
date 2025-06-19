
import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Percent, X } from "lucide-react";
import { DiscountCodeInput } from "@/components/checkout/DiscountCodeInput";
import { Button } from "@/components/ui/button";

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
  calculateDiscountedPrice: (originalPrice: number) => number;
  getDiscountAmount: (originalPrice: number) => number;
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
  calculateDiscountedPrice,
  getDiscountAmount,
  processing
}: PlanSummaryCardProps) {
  const originalPrice = price;
  const finalPrice = calculateDiscountedPrice(originalPrice);
  const discountAmount = getDiscountAmount(originalPrice);

  return (
    <Card className="border-warm-gold/30 bg-gradient-to-br from-white/80 to-warm-gold/5 p-6">
      <div className="space-y-6">
        {/* Plan Header */}
        <div className="text-center">
          <h3 className="text-xl font-semibold text-dark-base mb-2">
            {selectedPlan.name}
          </h3>
          <p className="text-muted-foreground text-sm">
            {selectedPlan.description || `${isLifetime ? "Lifetime" : "1-year"} access to premium features`}
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
                <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-medium">
                  <Percent className="h-4 w-4" />
                  You save ${discountAmount.toFixed(2)}
                </div>
              </div>
            ) : (
              <div className="text-3xl font-bold text-dark-base">
                ${originalPrice.toFixed(2)}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {isLifetime ? "One-time payment" : "Annual subscription"}
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
            <h4 className="font-medium text-dark-base">What's included:</h4>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Lifetime Badge */}
        {isLifetime && (
          <div className="text-center">
            <Badge variant="secondary" className="bg-warm-gold/20 text-warm-gold border-warm-gold/30">
              Lifetime Access
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}
