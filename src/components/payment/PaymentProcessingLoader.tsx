
import React from "react";
import { Loader2 } from "lucide-react";

interface PaymentProcessingLoaderProps {
  status: string;
  pollCount: number;
  maxPolls: number;
  debugInfo?: any;
}

export function PaymentProcessingLoader({ status, pollCount, maxPolls, debugInfo }: PaymentProcessingLoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
        <h2 className="text-xl font-semibold mb-2">Processing Your Payment</h2>
        <p className="text-gray-600 mb-4">
          Please wait while we verify your payment with PayPal...
        </p>
        <div className="text-sm text-gray-500">
          <p>Status: {status === 'checking' ? 'Checking payment status' : status}</p>
          <p className="mt-2">Verification attempt {pollCount} of {maxPolls}</p>
          <p className="mt-1">This may take a few moments</p>
        </div>
        {process.env.NODE_ENV === "development" && debugInfo && (
          <details className="text-left text-xs bg-gray-100 rounded-md p-3 mt-6 overflow-x-auto">
            <summary className="text-xs font-medium cursor-pointer">Debug info</summary>
            <pre className="whitespace-pre-wrap">{JSON.stringify(debugInfo, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
