
import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface PayPalErrorDisplayProps {
  error: string;
  onRetry: () => void;
  className?: string;
}

export function PayPalErrorDisplay({ error, onRetry, className = "" }: PayPalErrorDisplayProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="p-4 border border-red-200 rounded-md bg-red-50">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-600 text-sm font-medium">PayPal Unavailable</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
        <Button 
          className="w-full mt-3" 
          variant="outline"
          size="sm"
          onClick={onRetry}
        >
          Retry PayPal
        </Button>
      </div>
    </div>
  );
}
