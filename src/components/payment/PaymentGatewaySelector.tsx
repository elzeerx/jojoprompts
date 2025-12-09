import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Sparkles } from 'lucide-react';
import upaymentLogo from '@/assets/upayments-logo.jpeg';
import paypalLogo from '@/assets/paypal-logo.svg';
import { formatKWD, formatUSD } from '@/utils/currencyUtils';

export type PaymentGateway = 'paypal' | 'upayments';

interface PaymentGatewaySelectorProps {
  selectedGateway: PaymentGateway;
  onGatewayChange: (gateway: PaymentGateway) => void;
  usdPrice: number;
  kwdPrice: number;
  isGCC: boolean;
  className?: string;
}

/**
 * Payment gateway selector showing both PayPal and Upayments options
 * with a recommendation badge based on user's detected region
 */
export function PaymentGatewaySelector({
  selectedGateway,
  onGatewayChange,
  usdPrice,
  kwdPrice,
  isGCC,
  className
}: PaymentGatewaySelectorProps) {
  const recommendedGateway: PaymentGateway = isGCC ? 'upayments' : 'paypal';

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm font-medium text-muted-foreground mb-2">
        Choose Payment Method
      </p>

      {/* Upayments Option - Local Payment */}
      <button
        type="button"
        onClick={() => onGatewayChange('upayments')}
        className={cn(
          "w-full p-4 rounded-xl border-2 transition-all duration-200 text-left",
          "hover:border-warm-gold/50 hover:bg-warm-gold/5",
          selectedGateway === 'upayments'
            ? "border-warm-gold bg-warm-gold/10"
            : "border-gray-200 bg-white"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-200 overflow-hidden">
              <img src={upaymentLogo} alt="Upayments" className="w-7 h-7 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-dark-base">Upayments</span>
                {recommendedGateway === 'upayments' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warm-gold/20 text-warm-gold text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-dark-base mt-1">
                {formatKWD(kwdPrice)}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span className="px-1.5 py-0.5 bg-gray-100 rounded">KNET</span>
                <span className="px-1.5 py-0.5 bg-gray-100 rounded">Visa</span>
                <span className="px-1.5 py-0.5 bg-gray-100 rounded">Mastercard</span>
                <span className="px-1.5 py-0.5 bg-gray-100 rounded">Apple Pay</span>
              </div>
            </div>
          </div>
          <div className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1",
            selectedGateway === 'upayments'
              ? "border-warm-gold bg-warm-gold text-white"
              : "border-gray-300"
          )}>
            {selectedGateway === 'upayments' && <Check className="w-3 h-3" />}
          </div>
        </div>
      </button>

      {/* PayPal Option - International */}
      <button
        type="button"
        onClick={() => onGatewayChange('paypal')}
        className={cn(
          "w-full p-4 rounded-xl border-2 transition-all duration-200 text-left",
          "hover:border-warm-gold/50 hover:bg-warm-gold/5",
          selectedGateway === 'paypal'
            ? "border-warm-gold bg-warm-gold/10"
            : "border-gray-200 bg-white"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-200 overflow-hidden">
              <img src={paypalLogo} alt="PayPal" className="w-7 h-7 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-dark-base">PayPal</span>
                <span className="text-xs text-muted-foreground">(International)</span>
                {recommendedGateway === 'paypal' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warm-gold/20 text-warm-gold text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-dark-base mt-1">
                {formatUSD(usdPrice)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Pay with PayPal balance or linked cards
              </p>
            </div>
          </div>
          <div className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1",
            selectedGateway === 'paypal'
              ? "border-warm-gold bg-warm-gold text-white"
              : "border-gray-300"
          )}>
            {selectedGateway === 'paypal' && <Check className="w-3 h-3" />}
          </div>
        </div>
      </button>
    </div>
  );
}
