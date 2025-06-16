
import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface PaymentSuccessErrorProps {
  error: string;
}

export function PaymentSuccessError({ error }: PaymentSuccessErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg">
      <div className="text-center max-w-md mx-auto p-6">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Payment Processing Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <p className="text-sm text-gray-500 mb-4">Redirecting to payment failed page...</p>
        <div className="space-y-2">
          <Button className="w-full" asChild>
            <Link to="/pricing">Back to Pricing</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/contact">Contact Support</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
