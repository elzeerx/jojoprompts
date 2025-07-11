
import { useEffect } from "react";
import { usePaymentCallbackParams } from "@/hooks/payment/usePaymentCallbackParams";
import { usePaymentProcessing } from "@/hooks/payment/usePaymentProcessing";
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

  const {
    status,
    error,
    pollCount,
    MAX_POLLS
  } = usePaymentProcessing({
    success,
    paymentId,
    orderId,
    planId,
    userId,
    debugObject,
    hasSessionIndependentData
  });

  // Auto-capture for approved orders
  useEffect(() => {
    const attemptAutoCapture = async () => {
      if (success && orderId && !paymentId) {
        console.log('Attempting auto-capture for approved order:', orderId);
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
            console.log('Auto-capture successful:', data);
            // The payment processing hook will handle the rest
          } else {
            console.log('Auto-capture failed:', error || data?.error);
          }
        } catch (err) {
          console.log('Auto-capture error:', err);
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
