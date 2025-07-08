
import React from "react";
import { AlertTriangle } from "lucide-react";

interface PaymentProcessingErrorProps {
  error: string;
  debugInfo?: any;
}

export function PaymentProcessingError({ error, debugInfo }: PaymentProcessingErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg">
      <div className="text-center max-w-md mx-auto p-6">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Payment Verification Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <p className="text-sm text-gray-500">Redirecting to payment failed page...</p>
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
