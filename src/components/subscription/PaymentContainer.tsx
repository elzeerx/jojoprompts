
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
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

  const logPaymentEvent = (event: string, method: string, data?: any) => {
    const logData = {
      event,
      method,
      planName,
      amount,
      timestamp: new Date().toISOString(),
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
    onSuccess(paymentData);
  };

  const handlePaymentError = (error: any, method: string) => {
    logPaymentEvent('Payment Error', method, {
      error: error.message || error,
      errorCode: error.code
    });
    
    setProcessingMethod(null);
    setMethodErrors(prev => ({
      ...prev,
      [method]: error.message || 'Payment failed'
    }));

    // Check if we should disable the method after multiple failures
    if (error.critical) {
      setMethodAvailable(prev => ({
        ...prev,
        [method]: false
      }));
      logPaymentEvent('Payment Method Disabled', method, { reason: 'Critical error' });
    }

    onError(error);
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

  const bothMethodsUnavailable = !methodAvailable.paypal && !methodAvailable.tap;

  if (bothMethodsUnavailable) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Both payment methods are currently unavailable. Please try again later or contact support.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
              <Alert className="mb-4 border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  {methodErrors.paypal}
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
              <Alert className="mb-4 border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  {methodErrors.tap}
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

      {/* Security Notice */}
      <div className="mt-6 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <p className="text-xs font-medium text-gray-700">Secure Payment</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Your payment is secured with industry-standard encryption. Both payment methods are processed through secure, certified payment gateways.
        </p>
        
        {/* Fallback Information */}
        {(methodErrors.paypal || methodErrors.tap) && (
          <div className="mt-3 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-600">
              Having trouble? Try refreshing the page or contact our support team.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
