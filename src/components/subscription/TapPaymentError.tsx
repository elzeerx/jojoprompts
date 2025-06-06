
import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface TapPaymentErrorProps {
  error: string;
  retryCount: number;
  maxRetries: number;
  onRetry: () => void;
}

export function TapPaymentError({ error, retryCount, maxRetries, onRetry }: TapPaymentErrorProps) {
  const canRetry = retryCount < maxRetries;

  return (
    <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="h-4 w-4 text-red-500" />
        <p className="text-red-800 text-sm font-medium">Tap Payment Error</p>
      </div>
      <p className="text-red-700 text-sm mb-3">{error}</p>
      {canRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="flex items-center gap-2">
          <RefreshCw className="h-3 w-3" />
          Retry Payment ({retryCount + 1}/{maxRetries})
        </Button>
      )}
      {!canRetry && (
        <p className="text-red-600 text-xs">Maximum retry attempts reached. Please try again later.</p>
      )}
    </div>
  );
}
