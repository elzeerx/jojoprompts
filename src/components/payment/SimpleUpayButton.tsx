import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * V2 release-hardening: the legacy `process-upayments-payment` Edge Function
 * has been retired in favor of `v2-upayments-checkout` / `v2-upayments-status`
 * / `v2-upayments-webhook` / `v2-upayments-refund`, invoked exclusively from
 * `V2CheckoutPage`. This component is preserved only to keep historical
 * imports resolvable; it renders a disabled, non-interactive fallback and
 * MUST NOT be added to new UI. Route users to `/checkout` instead.
 */
interface SimpleUpayButtonProps {
  amountKWD?: number;
  amountUSD?: number;
  planId?: string;
  userId?: string;
  onSuccess?: (paymentData: any) => void;
  onError?: (error: any) => void;
  appliedDiscount?: unknown;
  language?: string;
}

export function SimpleUpayButton(_props: SimpleUpayButtonProps) {
  return (
    <div
      role="note"
      className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900"
      data-testid="simple-upay-button-retired"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden />
        <div className="flex-1">
          <div className="font-medium">Legacy checkout retired</div>
          <div className="text-xs opacity-80">
            This button used a retired Edge Function. Use the current checkout page.
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="min-h-[44px]">
          <a href="/checkout">Go to checkout</a>
        </Button>
      </div>
    </div>
  );
}
