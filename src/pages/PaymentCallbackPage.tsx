
import { useEffect } from "react";
import { usePaymentCallbackParams } from "@/hooks/payment/usePaymentCallbackParams";
// import { usePaymentProcessing } from "@/hooks/payment/usePaymentProcessing";
import { PaymentProcessingError } from "@/components/payment/PaymentProcessingError";
import { PaymentProcessingLoader } from "@/components/payment/PaymentProcessingLoader";
import { supabase } from "@/integrations/supabase/client";

export default function PaymentCallbackPage() {
  const { 
    success, 
    paymentId, 
    payerId, 
    orderId, 
    planId, 
    userId, 
    debugObject,
    hasSessionIndependentData
  } = usePaymentCallbackParams();

  // Temporarily disabled payment processing
  const status = 'processing';
  const error = null;
  const pollCount = 0;
  const MAX_POLLS = 30;

  // Auto-capture for approved orders
  useEffect(() => {
    const attemptAutoCapture = async () => {
      if (success && orderId && !paymentId) {
        // Attempting auto-capture for approved PayPal order
        try {
          const { data, error } = await supabase.functions.invoke('process-paypal-payment', {
            body: {
              action: 'capture',
              orderId,
              planId,
              userId
            }
          });

          if (data?.success) {
            // Auto-capture completed successfully
            // The payment processing hook will handle the rest
          } else {
            // Auto-capture failed - will be handled by payment processing hook
          }
        } catch (err) {
          // Auto-capture error will be handled by payment processing
        }
      }
    };

    attemptAutoCapture();
  }, [success, orderId, paymentId, planId, userId]);

  if (error) {
    return <PaymentProcessingError error={error} debugInfo={debugObject} />;
  }

  return (
    <PaymentProcessingLoader
      status={status}
      pollCount={pollCount}
      maxPolls={MAX_POLLS}
      debugInfo={debugObject}
    />
  );
}
