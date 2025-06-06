
import React from "react";
import { AlertCircle } from "lucide-react";

export function PaymentSecurityNotice() {
  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="h-4 w-4 text-green-600" />
        <p className="text-sm font-medium text-gray-700">Secure Payment Guarantee</p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Your payment is secured with industry-standard encryption. Both payment methods are processed through secure, certified payment gateways with fraud protection.
      </p>
      
      <div className="mt-3 pt-2 border-t border-gray-200">
        <p className="text-xs text-gray-600 mb-2">
          <strong>Having trouble?</strong>
        </p>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Try refreshing the page to reset payment systems</li>
          <li>• Disable browser extensions that might block payment scripts</li>
          <li>• Ensure cookies and JavaScript are enabled</li>
          <li>• Contact our support team if issues persist</li>
        </ul>
      </div>
    </div>
  );
}
