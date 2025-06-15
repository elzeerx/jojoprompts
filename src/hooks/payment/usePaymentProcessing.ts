
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/utils/secureLogging";

interface UsePaymentProcessingArgs {
  success: string | null;
  paymentId: string | null;
  orderId: string | null;
  planId: string | null;
  userId: string | null;
  debugObject: any;
}

export function usePaymentProcessing({
  success, paymentId, orderId, planId, userId, debugObject
}: UsePaymentProcessingArgs) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>('checking');
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [finalPaymentId, setFinalPaymentId] = useState<string | undefined>(paymentId);
  const MAX_POLLS = 35;

  const handlePaymentStatus = useCallback((paymentStatus: string, currentPollCount: number, paymentIdForSuccessParam?: string) => {
    setStatus(paymentStatus);
    setPollCount(currentPollCount + 1);

    if (paymentStatus === 'COMPLETED') {
      const successParams = new URLSearchParams();
      if (planId) successParams.append('planId', planId);
      if (userId) successParams.append('userId', userId);
      if (paymentIdForSuccessParam) successParams.append('payment_id', paymentIdForSuccessParam);
      if (orderId) successParams.append('order_id', orderId);
      navigate(`/payment-success?${successParams.toString()}`);
    } else if (['FAILED', 'DECLINED', 'CANCELLED', 'VOIDED', 'ERROR'].includes(paymentStatus)) {
      const failedParams = new URLSearchParams();
      if (planId) failedParams.append('planId', planId);
      failedParams.append('reason', `Payment ${paymentStatus.toLowerCase()}`);
      failedParams.append('status', paymentStatus);
      if (paymentIdForSuccessParam) failedParams.append('payment_id', paymentIdForSuccessParam);

      logError('Payment flow failed', 'PaymentCallbackPage', { paymentStatus, debugObject });
      navigate(`/payment-failed?${failedParams.toString()}`);
    }
  // eslint-disable-next-line
  }, [planId, userId, orderId, navigate]);

  useEffect(() => {
    if (success === 'false') {
      logError('PayPal payment cancelled', 'PaymentCallbackPage', { debugObject });
      setError('Payment was cancelled');
      setTimeout(() => {
        navigate(`/payment-failed?planId=${planId || ''}&reason=Payment cancelled`);
      }, 3000);
      return;
    }

    if (!orderId && !paymentId) {
      logError('No PayPal payment identifier found in URL parameters', 'PaymentCallbackPage', { debugObject });
      setError('Missing payment information in callback URL');
      setTimeout(() => {
        navigate(`/payment-failed?planId=${planId || ''}&reason=Missing payment reference`);
      }, 3000);
      return;
    }

    // Improved: Always POST with both orderId and paymentId if either is available
    const poll = async (currentPollCount: number = 0, paymentIdArg?: string) => {
      if (currentPollCount >= MAX_POLLS) {
        logError('Payment verification timeout', 'PaymentCallbackPage', { paymentId, orderId, debugObject });
        setError('Payment verification timeout (PayPal sometimes needs several minutes to confirm). Please contact support with your order ID.');
        setTimeout(() => {
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment verification timeout`);
        }, 3000);
        return;
      }
      try {
        const args: Record<string, string> = {};
        if (orderId) args['order_id'] = orderId;
        if (paymentIdArg || paymentId) args['payment_id'] = paymentIdArg || paymentId!;

        // Use POST to verify-paypal-payment, backend now robustly handles body & query params
        const { data, error } = await supabase.functions.invoke("verify-paypal-payment", {
          body: args,
        });

        let result = data;

        // Harden against missing/strange responses
        if (!result || !result.status) {
          setError('Could not verify payment status with PayPal.');
          logError("Unable to determine payment status", "PaymentCallbackPage", { debugObject, result });
          setTimeout(() => {
            navigate(`/payment-failed?planId=${planId || ''}&reason=Unable to determine payment status`);
          }, 3500);
          return;
        }

        // If status is APPROVED and not yet captured, poll again (should be soon captured)
        if (result.status === "APPROVED" && orderId && currentPollCount < MAX_POLLS) {
          setTimeout(() => poll(currentPollCount + 1, paymentIdArg), 1800);
          return;
        }

        // Robust paymentId extraction after backend refactor
        const paymentIdOut =
          result.paymentId ||
          result.paypal?.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
          result.paypal?.id ||
          result.paypal_payment_id ||
          paymentIdArg ||
          paymentId ||
          undefined;

        setFinalPaymentId(paymentIdOut);

        handlePaymentStatus(result.status, currentPollCount, paymentIdOut);
      } catch (error: any) {
        logError('Payment verification failed', 'PaymentCallbackPage', { error, paymentId, orderId, debugObject });
        setError(error.message || "Payment verification failed");
        setTimeout(() => {
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment verification failed: ${error.message || "unknown error"}`);
        }, 3000);
      }
    };

    if (success === 'true') {
      poll(0, paymentId);
    } else {
      poll(0);
    }
    // eslint-disable-next-line
  }, [success, paymentId, orderId, planId, userId, debugObject, navigate, handlePaymentStatus]); 

  return { status, error, pollCount, MAX_POLLS, finalPaymentId };
}
// ...end of file...
