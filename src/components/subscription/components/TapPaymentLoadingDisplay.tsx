
import React from "react";
import { Loader2 } from "lucide-react";

interface TapPaymentLoadingDisplayProps {
  className?: string;
}

export function TapPaymentLoadingDisplay({ className = "" }: TapPaymentLoadingDisplayProps) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="ml-2">Initializing secure payment...</span>
    </div>
  );
}
