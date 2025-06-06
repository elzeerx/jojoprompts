
import React from "react";
import { PayPalPayment } from "./PayPalPayment";
import { TapPayment } from "./TapPayment";
import { usePaymentState } from "@/hooks/usePaymentState";
import { PaymentMethodCard } from "./PaymentMethodCard";
import { PaymentErrorAlert } from "./PaymentErrorAlert";
import { PaymentSecurityNotice } from "./PaymentSecurityNotice";
import { PaymentFallback } from "./PaymentFallback";

interface PaymentContainerProps {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
}

export function PaymentContainer({ amount, planName, onSuccess, onError }: PaymentContainerProps) {
  const {
    processingMethod,
    methodErrors,
    methodAvailable,
    retryAttempts,
    maxRetryAttempts,
    handlePaymentStart,
    handlePaymentSuccess,
    handlePaymentError,
    handleMethodUnavailable,
    handleRetryMethod,
    bothMethodsUnavailable,
    hasAnyErrors
  } = usePaymentState();

  const wrappedOnSuccess = (paymentData: any) => {
    handlePaymentSuccess(paymentData);
    onSuccess(paymentData);
  };

  const wrappedOnError = (error: any, method: string) => {
    handlePaymentError(error, method);
    onError(error);
  };

  if (bothMethodsUnavailable) {
    return <PaymentFallback />;
  }

  return (
    <div className="space-y-6">
      <PaymentErrorAlert hasErrors={!!hasAnyErrors} />

      {/* PayPal Section */}
      {methodAvailable.paypal && (
        <PaymentMethodCard
          title="PayPal"
          description="Pay with PayPal, debit card, or credit card"
          badge="Recommended"
          error={methodErrors.paypal}
          retryCount={retryAttempts.paypal}
          maxRetries={maxRetryAttempts}
          isProcessing={processingMethod !== null}
          isBlocked={processingMethod !== null && processingMethod !== 'paypal'}
          onRetry={() => handleRetryMethod('paypal')}
        >
          <PayPalPayment
            amount={amount}
            planName={planName}
            onSuccess={wrappedOnSuccess}
            onError={(error) => wrappedOnError(error, 'paypal')}
            onStart={() => handlePaymentStart('paypal')}
            onUnavailable={(reason) => handleMethodUnavailable('paypal', reason)}
          />
        </PaymentMethodCard>
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
        <PaymentMethodCard
          title="Tap Payments (KWD)"
          description="Pay with your local credit card in Kuwaiti Dinar"
          error={methodErrors.tap}
          retryCount={retryAttempts.tap}
          maxRetries={maxRetryAttempts}
          isProcessing={processingMethod !== null}
          isBlocked={processingMethod !== null && processingMethod !== 'tap'}
          onRetry={() => handleRetryMethod('tap')}
        >
          <TapPayment
            amount={amount}
            planName={planName}
            onSuccess={wrappedOnSuccess}
            onError={(error) => wrappedOnError(error, 'tap')}
            onStart={() => handlePaymentStart('tap')}
            onUnavailable={(reason) => handleMethodUnavailable('tap', reason)}
          />
        </PaymentMethodCard>
      )}

      <PaymentSecurityNotice />
    </div>
  );
}
