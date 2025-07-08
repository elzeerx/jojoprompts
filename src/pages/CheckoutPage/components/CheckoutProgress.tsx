
import React from "react";
import { Check, ArrowRight } from "lucide-react";

interface CheckoutProgressProps {
  showAuthForm: boolean;
}

export function CheckoutProgress({ showAuthForm }: CheckoutProgressProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-center space-x-4 text-sm">
        <div className={`flex items-center ${showAuthForm ? 'text-warm-gold' : 'text-green-600'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs mr-2 ${showAuthForm ? 'bg-warm-gold' : 'bg-green-600'}`}>
            {showAuthForm ? '1' : <Check className="h-3 w-3" />}
          </div>
          <span>Create Account</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div className={`flex items-center ${!showAuthForm ? 'text-warm-gold' : 'text-muted-foreground'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs mr-2 ${!showAuthForm ? 'bg-warm-gold' : 'bg-gray-300'}`}>
            2
          </div>
          <span>Complete Payment</span>
        </div>
      </div>
    </div>
  );
}
