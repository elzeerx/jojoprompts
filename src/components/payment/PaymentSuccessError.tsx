
import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

// Enhanced logic to show success state if what is supplied as "error" actually means payment succeeded.
interface PaymentSuccessErrorProps {
  error: string;
}

function isSuccessMessage(str: string) {
  // Crude but effective, could match keywords
  const normalized = str.toLowerCase();
  return (
    normalized.includes("payment complete") ||
    normalized.includes("subscription is now active") ||
    normalized.includes("subscription has been activated") ||
    normalized.includes("success") ||
    normalized.includes("redirecting you now") ||
    normalized.includes("you can access your plan") ||
    normalized.includes("your subscription is active")
  );
}

export function PaymentSuccessError({ error }: PaymentSuccessErrorProps) {
  const success = isSuccessMessage(error);

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg">
      <div className="text-center max-w-md mx-auto p-6">
        {success ? (
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
        ) : (
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        )}
        <h2 className={"text-xl font-semibold mb-2 " + (success ? "text-green-700" : "")}>
          {success ? "Payment Successful!" : "Payment Processing Error"}
        </h2>
        <p className="text-gray-600 mb-4">{error}</p>
        {!success && (
          <p className="text-sm text-gray-500 mb-4">Redirecting to payment failed page...</p>
        )}
        <div className="space-y-2">
          <Button className="w-full" asChild>
            <Link to="/pricing">{success ? "View Plans" : "Back to Pricing"}</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/contact">{success ? "Contact Support" : "Contact Support"}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
