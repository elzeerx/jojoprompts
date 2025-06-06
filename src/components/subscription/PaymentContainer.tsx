
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PayPalPayment } from "./PayPalPayment";
import { TapPayment } from "./TapPayment";

interface PaymentContainerProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
}

export function PaymentContainer({ amount, planName, onSuccess, onError }: PaymentContainerProps) {
  const [processingMethod, setProcessingMethod] = useState<string | null>(null);
  const [methodErrors, setMethodErrors] = useState<{
    paypal?: string;
    tap?: string;
  }>({});
  const [methodAvailable, setMethodAvailable] = useState<{
    paypal: boolean;
    tap: boolean;
  }>({
    paypal: true,
    tap: true
  });
  const [retryAttempts, setRetryAttempts] = useState<{
    paypal: number;
    tap: number;
  }>({
    paypal: 0,
    tap: 0
  });

  const maxRetryAttempts = 3;

  const logPaymentEvent = (event: string, method: string, data?: any) => {
    const logData = {
      event,
      method,
      planName,
      amount,
      timestamp: new Date().toISOString(),
      retryAttempts: retryAttempts[method as keyof typeof retryAttempts],
      ...data
    };
    console.log(`[Payment Container] ${event}:`, logData);
  };

  const handlePaymentSuccess = (paymentData: any) => {
    logPaymentEvent('Payment Success', paymentData.paymentMethod, {
      paymentId: paymentData.paymentId
    });
    setProcessingMethod(null);
    setMethodErrors({});
    // Reset retry attempts on success
    setRetryAttempts({ paypal: 0, tap: 0 });
    onSuccess(paymentData);
  };

  const handlePaymentError = (error: any, method: string) => {
    logPaymentEvent('Payment Error', method, {
      error: error.message || error,
      errorCode: error.code,
      attempt: retryAttempts[method as keyof typeof retryAttempts] + 1
    });
    
    setProcessingMethod(null);
    
    // Increment retry attempts
    setRetryAttempts(prev => ({
      ...prev,
      [method]: prev[method as keyof typeof prev] + 1
    }));

    // Provide user-friendly error messages
    let userFriendlyMessage = getUserFriendlyErrorMessage(error, method);
    
    setMethodErrors(prev => ({
      ...prev,
      [method]: userFriendlyMessage
    }));

    // Check if we should disable the method after multiple failures
    if (error.critical || retryAttempts[method as keyof typeof retryAttempts] >= maxRetryAttempts) {
      setMethodAvailable(prev => ({
        ...prev,
        [method]: false
      }));
      logPaymentEvent('Payment Method Disabled', method, { 
        reason: error.critical ? 'Critical error' : 'Max retries exceeded' 
      });
    }

    onError(error);
  };

  const getUserFriendlyErrorMessage = (error: any, method: string): string => {
    const methodName = method === 'paypal' ? 'PayPal' : 'Tap';
    
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return `Network connection issue with ${methodName}. Please check your internet connection.`;
    }
    
    if (error.message?.includes('timeout')) {
      return `${methodName} is taking too long to respond. Please try again.`;
    }
    
    if (error.message?.includes('script') || error.message?.includes('load')) {
      return `${methodName} payment system failed to load. Please refresh the page and try again.`;
    }
    
    if (error.message?.includes('configuration') || error.message?.includes('config')) {
      return `${methodName} is temporarily unavailable due to configuration issues. Please try the other payment method.`;
    }
    
    if (error.message?.includes('authentication') || error.message?.includes('auth')) {
      return `Authentication error with ${methodName}. Please refresh the page and try again.`;
    }
    
    // Default user-friendly message
    return `${methodName} encountered an issue. Please try again or use the alternative payment method.`;
  };

  const handlePaymentStart = (method: string) => {
    logPaymentEvent('Payment Started', method);
    setProcessingMethod(method);
    setMethodErrors(prev => ({
      ...prev,
      [method]: undefined
    }));
  };

  const handleMethodUnavailable = (method: string, reason: string) => {
    logPaymentEvent('Payment Method Unavailable', method, { reason });
    setMethodAvailable(prev => ({
      ...prev,
      [method]: false
    }));
    setMethodErrors(prev => ({
      ...prev,
      [method]: `${method === 'paypal' ? 'PayPal' : 'Tap'} is currently unavailable: ${reason}`
    }));
  };

  const handleRetryMethod = (method: string) => {
    if (retryAttempts[method as keyof typeof retryAttempts] >= maxRetryAttempts) {
      return;
    }

    logPaymentEvent('Manual Retry Initiated', method, { 
      attempt: retryAttempts[method as keyof typeof retryAttempts] + 1 
    });
    
    setMethodErrors(prev => ({
      ...prev,
      [method]: undefined
    }));
    
    setMethodAvailable(prev => ({
      ...prev,
      [method]: true
    }));
  };

  const bothMethodsUnavailable = !methodAvailable.paypal && !methodAvailable.tap;
  const hasAnyErrors = methodErrors.paypal || methodErrors.tap;

  if (bothMethodsUnavailable) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="mb-4">
              Both payment methods are currently unavailable. This might be due to:
            </AlertDescription>
          </Alert>
          <ul className="text-sm text-muted-foreground mb-4 ml-4 space-y-1">
            <li>• Network connectivity issues</li>
            <li>• Temporary service maintenance</li>
            <li>• Browser compatibility issues</li>
          </ul>
          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => window.location.reload()} 
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Page
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              If the issue persists, please contact support
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Error Recovery */}
      {hasAnyErrors && (
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
      )}

      {/* PayPal Section */}
      {methodAvailable.paypal && (
        <Card className="relative">
          <CardContent className="p-6">
            <div className="mb-4">
              <h4 className="font-medium flex items-center gap-2">
                <span>PayPal</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Recommended</span>
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Pay with PayPal, debit card, or credit card
              </p>
            </div>
            
            {processingMethod && processingMethod !== 'paypal' && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Another payment method is processing...
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {methodErrors.paypal && (
              <Alert className="mb-4 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {methodErrors.paypal}
                  {retryAttempts.paypal < maxRetryAttempts && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleRetryMethod('paypal')}
                      className="ml-2 h-6 text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry ({retryAttempts.paypal + 1}/{maxRetryAttempts})
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            <PayPalPayment
              amount={amount}
              planName={planName}
              onSuccess={handlePaymentSuccess}
              onError={(error) => handlePaymentError(error, 'paypal')}
              onStart={() => handlePaymentStart('paypal')}
              onUnavailable={(reason) => handleMethodUnavailable('paypal', reason)}
            />
          </CardContent>
        </Card>
      )}

      {/* Divider - only show if both methods are available */}
      {methodAvailable.paypal && methodAvailable.tap && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>
      )}

      {/* Tap Payment Section */}
      {methodAvailable.tap && (
        <Card className="relative">
          <CardContent className="p-6">
            <div className="mb-4">
              <h4 className="font-medium">Tap Payments (KWD)</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Pay with your local credit card in Kuwaiti Dinar
              </p>
            </div>
            
            {processingMethod && processingMethod !== 'tap' && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Another payment method is processing...
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {methodErrors.tap && (
              <Alert className="mb-4 border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {methodErrors.tap}
                  {retryAttempts.tap < maxRetryAttempts && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleRetryMethod('tap')}
                      className="ml-2 h-6 text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry ({retryAttempts.tap + 1}/{maxRetryAttempts})
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
            
            <TapPayment
              amount={amount}
              planName={planName}
              onSuccess={handlePaymentSuccess}
              onError={(error) => handlePaymentError(error, 'tap')}
              onStart={() => handlePaymentStart('tap')}
              onUnavailable={(reason) => handleMethodUnavailable('tap', reason)}
            />
          </CardContent>
        </Card>
      )}

      {/* Enhanced Security Notice */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <p className="text-sm font-medium text-gray-700">Secure Payment Guarantee</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Your payment is secured with industry-standard encryption. Both payment methods are processed through secure, certified payment gateways with fraud protection.
        </p>
        
        {/* Enhanced Fallback Information */}
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
    </div>
  );
}
