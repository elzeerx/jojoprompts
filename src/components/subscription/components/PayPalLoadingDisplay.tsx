
import React from "react";
import { Loader2 } from "lucide-react";

interface PayPalLoadingDisplayProps {
  className?: string;
}

export function PayPalLoadingDisplay({ className = "" }: PayPalLoadingDisplayProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="w-full min-h-[45px] flex items-center justify-center bg-gray-50 rounded border border-gray-200">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm text-gray-600">Loading PayPal...</span>
      </div>
    </div>
  );
}
