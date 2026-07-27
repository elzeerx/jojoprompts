import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * V2 release-hardening: PayPal checkout paths (create / verify / capture /
 * auto-capture) have been retired at the Edge Function level. This component
 * is preserved so historical imports keep resolving; it renders a disabled,
 * non-interactive fallback and never invokes a Supabase function.
 */
interface SimplePayPalButtonProps {
  amount?: number;
  planId?: string;
  userId?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  appliedDiscount?: unknown;
}

export function SimplePayPalButton(_props: SimplePayPalButtonProps) {
  return (
    <div
      role="note"
      className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900"
      data-testid="simple-paypal-button-retired"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden />
        <div className="flex-1">
          <div className="font-medium">PayPal checkout retired</div>
          <div className="text-xs opacity-80">
            The PayPal client path is no longer supported. Use the current checkout.
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="min-h-[44px]">
          <a href="/checkout">Go to checkout</a>
        </Button>
      </div>
    </div>
  );
}
