
import React from "react";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";

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
        if (pollCount > 15) {
          return {
            icon: <Clock className="h-8 w-8 text-orange-600" />,
            title: "Verifying Payment Status",
            message: "This is taking longer than usual. We're checking your payment status with PayPal..."
          };
        }
        return {
          icon: <Loader2 className="h-8 w-8 animate-spin text-blue-600" />,
          title: "Verifying Your Payment",
          message: "Please wait while we confirm your payment with PayPal..."
        };
      case 'APPROVED':
        return {
          icon: <Loader2 className="h-8 w-8 animate-spin text-orange-600" />,
          title: "Processing Payment",
          message: "Your payment has been approved and is being processed..."
        };
      case 'COMPLETED':
        return {
          icon: <CheckCircle className="h-8 w-8 text-green-600" />,
          title: "Payment Successful!",
          message: "Your payment has been completed successfully. Redirecting..."
        };
      case 'FAILED':
      case 'DECLINED':
      case 'CANCELLED':
        return {
          icon: <XCircle className="h-8 w-8 text-red-600" />,
          title: "Payment Failed",
          message: `Your payment was ${status.toLowerCase()}. Redirecting...`
        };
      default:
        return {
          icon: <Loader2 className="h-8 w-8 animate-spin text-blue-600" />,
          title: "Processing...",
          message: "Please wait while we process your payment..."
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const progressPercentage = Math.min((pollCount / maxPolls) * 100, 100);

  return (
    <div className="min-h-screen flex items-center justify-center bg-soft-bg">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="mb-6">
          {statusDisplay.icon}
        </div>
        
        <h2 className="text-2xl font-semibold mb-4">{statusDisplay.title}</h2>
        <p className="text-gray-600 mb-6">{statusDisplay.message}</p>
        
        {/* Progress bar for verification attempts */}
        {status === 'checking' && pollCount > 0 && (
          <div className="mb-4">
            <div className="bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">
              Verification attempt {pollCount} of {maxPolls}
            </p>
          </div>
        )}

        {/* Enhanced messaging for long waits */}
        {pollCount > 10 && status === 'checking' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-700 mb-2">
              <strong>Payment verification is taking longer than usual.</strong>
            </p>
            <p className="text-sm text-blue-600">
              This can happen during high traffic periods or PayPal processing delays. 
              We're actively checking your payment status and will redirect you once confirmed.
            </p>
            <p className="text-xs text-blue-500 mt-2">
              Please don't close this page - we'll keep trying.
            </p>
          </div>
        )}

        {/* Warning for very long waits */}
        {pollCount > 25 && status === 'checking' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-orange-700">
              <strong>Still verifying your payment...</strong><br />
              If your payment was successful, you'll be redirected shortly. 
              If this continues, please contact support with your order details.
            </p>
          </div>
        )}

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
