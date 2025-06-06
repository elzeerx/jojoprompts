
import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface PaymentErrorAlertProps {
  hasErrors: boolean;
}

export function PaymentErrorAlert({ hasErrors }: PaymentErrorAlertProps) {
  if (!hasErrors) return null;

  return (
    <Alert className="border-yellow-200 bg-yellow-50">
      <AlertCircle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-yellow-800">
        Having trouble with payments? You can:
        <div className="mt-2 space-y-1 text-sm">
          <div>• Try the alternative payment method</div>
          <div>• Refresh the page to reset payment systems</div>
          <div>• Contact support if issues persist</div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
