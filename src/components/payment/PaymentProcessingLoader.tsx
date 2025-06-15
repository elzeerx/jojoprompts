
import React from "react";
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle, Shield } from "lucide-react";

interface PaymentProcessingLoaderProps {
  status: string;
  pollCount: number;
  maxPolls: number;
  debugInfo?: any;
}

export function PaymentProcessingLoader({ 
  status, 
  pollCount, 
  maxPolls, 
  debugInfo 
}: PaymentProcessingLoaderProps) {
  const getStatusDisplay = () => {
    switch (status) {
      case 'checking':
        if (pollCount > 20) {
          return {
            icon: <AlertTriangle className="h-8 w-8 text-orange-600" />,
            title: "Extended Verification in Progress",
            message: "We're working extra hard to verify your payment. This sometimes happens during high traffic periods or when there are temporary delays with PayPal's system.",
            color: "orange"
          };
        } else if (pollCount > 10) {
          return {
            icon: <Clock className="h-8 w-8 text-blue-600" />,
            title: "Verifying Payment Status",
            message: "We're checking your payment status with PayPal and updating our database. This usually takes just a moment...",
            color: "blue"
          };
        }
        return {
          icon: <Loader2 className="h-8 w-8 animate-spin text-blue-600" />,
          title: "Processing Your Payment",
          message: "Please wait while we securely verify your payment with PayPal...",
          color: "blue"
        };
      case 'APPROVED':
        return {
          icon: <RefreshCw className="h-8 w-8 animate-spin text-orange-600" />,
          title: "Finalizing Payment",
          message: "Your payment has been approved and is being finalized. Almost done!",
          color: "orange"
        };
      case 'COMPLETED':
        return {
          icon: <CheckCircle className="h-8 w-8 text-green-600" />,
          title: "Payment Successful!",
          message: "Your payment has been completed successfully. Redirecting you now...",
          color: "green"
        };
      case 'FAILED':
      case 'DECLINED':
      case 'CANCELLED':
        return {
          icon: <XCircle className="h-8 w-8 text-red-600" />,
          title: "Payment Not Completed",
          message: `Your payment was ${status.toLowerCase()}. You will be redirected to try again.`,
          color: "red"
        };
      default:
        return {
          icon: <Loader2 className="h-8 w-8 animate-spin text-blue-600" />,
          title: "Processing...",
          message: "Please wait while we handle your payment...",
          color: "blue"
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const progressPercentage = Math.min((pollCount / maxPolls) * 100, 100);

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg p-4">
      <div className="text-center max-w-lg mx-auto p-6">
        <div className="mb-6 flex justify-center">
          {statusDisplay.icon}
        </div>
        
        <h2 className="text-2xl font-semibold mb-4 text-gray-900">{statusDisplay.title}</h2>
        <p className="text-gray-600 mb-6 leading-relaxed">{statusDisplay.message}</p>
        
        {/* Enhanced progress bar for verification attempts */}
        {status === 'checking' && pollCount > 0 && (
          <div className="mb-6">
            <div className="bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${
                  statusDisplay.color === 'orange' ? 'bg-orange-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">
              Verification step {pollCount} of {maxPolls}
            </p>
          </div>
        )}

        {/* Enhanced messaging for different wait times */}
        {pollCount > 5 && pollCount <= 15 && status === 'checking' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-blue-800 mb-1">
                  Secure Payment Processing
                </p>
                <p className="text-sm text-blue-700">
                  We're working with PayPal to ensure your payment is processed securely. 
                  This extra verification helps protect your account and transaction.
                </p>
              </div>
            </div>
          </div>
        )}

        {pollCount > 15 && status === 'checking' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-orange-800 mb-2">
                  Extended Processing Time
                </p>
                <p className="text-sm text-orange-700 mb-2">
                  Your payment is taking longer than usual to verify. This can happen during:
                </p>
                <ul className="text-sm text-orange-600 space-y-1">
                  <li>• High traffic periods</li>
                  <li>• Temporary PayPal system delays</li>
                  <li>• Enhanced security checks</li>
                </ul>
                <p className="text-xs text-orange-500 mt-2">
                  Please don't close this page - we'll complete the verification automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Session restoration info */}
        {pollCount > 3 && status === 'checking' && !debugInfo?.validation?.hasSessionIndependentData && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-yellow-800 mb-1">
                  Restoring Your Session
                </p>
                <p className="text-sm text-yellow-700">
                  We're working to restore your login session after the PayPal redirect. 
                  This is normal and helps ensure your account security.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Critical wait warning */}
        {pollCount > 25 && status === 'checking' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-red-800 mb-2">
                  Payment Verification Issue
                </p>
                <p className="text-sm text-red-700 mb-2">
                  We're experiencing difficulties verifying your payment. If your PayPal payment was successful:
                </p>
                <ul className="text-sm text-red-600 space-y-1">
                  <li>• Your account will be updated within 24 hours</li>
                  <li>• You'll receive an email confirmation</li>
                  <li>• Contact support if you need immediate assistance</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Security assurance */}
        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />
            Your payment information is secure and encrypted
          </p>
        </div>

        {/* Debug info in development */}
        {process.env.NODE_ENV === "development" && debugInfo && (
          <details className="text-left text-xs bg-gray-100 rounded-md p-3 mt-6 overflow-x-auto">
            <summary className="text-xs font-medium cursor-pointer">Debug info</summary>
            <pre className="whitespace-pre-wrap mt-2">{JSON.stringify(debugInfo, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
