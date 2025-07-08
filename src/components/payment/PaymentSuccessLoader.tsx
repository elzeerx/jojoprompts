
import { Loader2 } from "lucide-react";
import React from "react";

export function PaymentSuccessLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-lg">Verifying your payment...</p>
        <p className="text-sm text-gray-600 mt-2">Please wait while we confirm your subscription</p>
      </div>
    </div>
  );
}
