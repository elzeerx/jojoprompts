import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, CreditCard, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { PayPalButton } from "@/components/subscription/PayPalButton";
import { SecureTapPaymentButton } from "@/components/subscription/SecureTapPaymentButton";
import { usePaymentManager } from "@/components/subscription/hooks/usePaymentManager";
import { Button } from "@/components/ui/button";

interface PaymentMethodsCardProps {
  processing: boolean;
  price: number;
  planName: string;
  handlePaymentSuccess: (paymentData: any) => void;
  handlePaymentError: (error: any) => void;
}

export function PaymentMethodsCard({
  processing,
  price,
  planName,
  handlePaymentSuccess,
  handlePaymentError
}: PaymentMethodsCardProps) {
  const {
    paypalReady,
    tapReady,
    paypalError,
    tapError,
    isInitializing,
    hasAnyPaymentMethod,
    retryPayPal,
    retryTap
  } = usePaymentManager();

  const [paypalKey, setPaypalKey] = React.useState(0);
  const [tapKey, setTapKey] = React.useState(0);

  console.log("PaymentMethodsCard state:", { 
    paypalReady, 
    tapReady, 
    paypalError, 
    tapError, 
    isInitializing,
    hasAnyPaymentMethod 
  });

  const handlePayPalError = (error: any) => {
    console.error("PayPal error in PaymentMethodsCard:", error);
    handlePaymentError(error);
  };

  const handleTapError = (error: any) => {
    console.error("Tap error in PaymentMethodsCard:", error);
    handlePaymentError(error);
  };

  const handleRetryPayPal = () => {
    console.log("Retrying PayPal...");
    retryPayPal();
    setPaypalKey(prev => prev + 1);
  };

  const handleRetryTap = () => {
    console.log("Retrying Tap Payment...");
    retryTap();
    setTapKey(prev => prev + 1);
  };

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" />
          Payment Methods
          {isInitializing && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          All payments are processed securely. Your payment information is encrypted and protected.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {processing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="font-medium">Processing payment...</p>
              <p className="text-sm text-muted-foreground">Please don't close this page</p>
            </div>
          </div>
        )}

        {isInitializing && (
          <div className="text-center py-4">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Initializing payment methods...</p>
          </div>
        )}

        {!isInitializing && !hasAnyPaymentMethod && (
          <div className="text-center py-6 bg-orange-50 rounded-lg border border-orange-200">
            <AlertTriangle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
            <h4 className="font-medium text-orange-800 mb-2">Payment Methods Unavailable</h4>
            <p className="text-sm text-orange-700 mb-4">
              Both payment methods are currently experiencing issues. Please try refreshing the page or contact support.
            </p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={handleRetryPayPal}>
                Retry PayPal
              </Button>
              <Button size="sm" variant="outline" onClick={handleRetryTap}>
                Retry Tap Payment
              </Button>
            </div>
          </div>
        )}
        
        <div className="space-y-6">
          {/* PayPal Section */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <span>PayPal</span>
              {paypalReady && <CheckCircle className="h-4 w-4 text-green-600" />}
              {paypalError && <XCircle className="h-4 w-4 text-red-600" />}
              {!paypalError && !paypalReady && isInitializing && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Recommended</span>
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Pay with PayPal, debit card, or credit card through PayPal's secure checkout
            </p>
            
            {paypalError && (
              <div className="mb-3 p-3 bg-red-50 rounded border border-red-200">
                <p className="text-sm text-red-800 mb-2">{paypalError}</p>
                <Button size="sm" variant="outline" onClick={handleRetryPayPal}>
                  Retry PayPal
                </Button>
              </div>
            )}
            
            <div className="min-h-[60px]">
              {paypalReady && (
                <PayPalButton
                  key={paypalKey}
                  amount={price}
                  planName={planName}
                  onSuccess={(paymentId, details) => {
                    console.log("PayPal payment success:", { paymentId, details });
                    handlePaymentSuccess({
                      paymentId,
                      paymentMethod: 'paypal',
                      details
                    });
                  }}
                  onError={handlePayPalError}
                  className="w-full"
                />
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or pay with local payment
              </span>
            </div>
          </div>

          {/* Tap Payment Section */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span>Tap Payments (KWD)</span>
              {tapReady && <CheckCircle className="h-4 w-4 text-green-600" />}
              {tapError && <XCircle className="h-4 w-4 text-red-600" />}
              {!tapError && !tapReady && isInitializing && <Loader2 className="h-4 w-4 animate-spin" />}
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Pay with your local credit card in Kuwaiti Dinar through Tap's secure payment gateway
            </p>
            
            {tapError && (
              <div className="mb-3 p-3 bg-red-50 rounded border border-red-200">
                <p className="text-sm text-red-800 mb-2">{tapError}</p>
                <Button size="sm" variant="outline" onClick={handleRetryTap}>
                  Retry Tap Payment
                </Button>
              </div>
            )}
            
            <div className="min-h-[60px]">
              {tapReady && (
                <SecureTapPaymentButton
                  key={tapKey}
                  amount={price}
                  planName={planName}
                  onSuccess={(paymentId) => {
                    console.log("Tap payment success:", { paymentId });
                    handlePaymentSuccess({
                      paymentId,
                      paymentMethod: 'tap',
                      payment_id: paymentId
                    });
                  }}
                  onError={handleTapError}
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-green-600" />
            <p className="text-xs font-medium text-gray-700">Secure Payment</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Your payment is secured with 256-bit SSL encryption. We never store your payment details.
          </p>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-blue-800">Having trouble?</p>
              <p className="text-xs text-blue-700 mt-1">
                If a payment method isn't working, try refreshing the page or using the retry buttons above.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
