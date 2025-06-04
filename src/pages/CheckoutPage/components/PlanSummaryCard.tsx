
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Check } from "lucide-react";

interface PlanSummaryCardProps {
  selectedPlan: any;
  price: number;
  features: string[];
  isLifetime: boolean;
}

export function PlanSummaryCard({ selectedPlan, price, features, isLifetime }: PlanSummaryCardProps) {
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
          <div className="text-3xl font-bold text-warm-gold">
            ${price}
            {isLifetime ? (
              <span className="text-lg text-muted-foreground"> one-time</span>
            ) : (
              <span className="text-lg text-muted-foreground"> for 1 year</span>
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
      </CardContent>
    </Card>
  );
}
