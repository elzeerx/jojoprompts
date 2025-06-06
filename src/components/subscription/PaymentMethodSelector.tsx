
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface PaymentMethodSelectorProps {
  onSelectMethod: (method: 'paypal' | 'tap') => void;
  disabled?: boolean;
}

export function PaymentMethodSelector({ onSelectMethod, disabled }: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-center">Choose Payment Method</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <Button
              variant="outline"
              onClick={() => onSelectMethod('paypal')}
              disabled={disabled}
              className="w-full h-auto p-6 flex flex-col items-center gap-3"
            >
              <div className="text-2xl">💳</div>
              <div className="text-center">
                <div className="font-semibold">PayPal</div>
                <div className="text-sm text-muted-foreground">
                  Pay with PayPal, debit or credit card
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <Button
              variant="outline"
              onClick={() => onSelectMethod('tap')}
              disabled={disabled}
              className="w-full h-auto p-6 flex flex-col items-center gap-3"
            >
              <div className="text-2xl">🏦</div>
              <div className="text-center">
                <div className="font-semibold">Tap Payments</div>
                <div className="text-sm text-muted-foreground">
                  Pay with credit card (USD)
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
