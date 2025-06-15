
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
  const MAX_POLLS = 20;

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

  // Payment capture and poll logic
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

    let didCapture = false;

    const doCaptureIfNeeded = async (): Promise<{captured: boolean, paymentId?: string}> => {
      if (!orderId) return { captured: false, paymentId };
      try {
        const { data, error } = await supabase.functions.invoke("process-paypal-payment", {
          body: {
            action: 'capture',
            orderId,
            userId,
            planId,
          },
        });
        if (error || !data?.success) {
          logError('PayPal capture failed', 'PaymentCallbackPage', { data, error, orderId, userId, planId });
          throw new Error(error?.message || data?.error || "PayPal capture failed");
        }
        didCapture = true;
        setFinalPaymentId(data.paymentId);
        return { captured: true, paymentId: data.paymentId };
      } catch (err: any) {
        logError('Payment capture failed', 'PaymentCallbackPage', { details: err, debugObject });
        setError('Payment capture failed: ' + (err.message || err));
        setTimeout(() => {
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment capture failed: ${(err.message || err)}`);
        }, 4000);
        throw err;
      }
    };

    const poll = async (currentPollCount: number = 0, paymentIdArg?: string) => {
      if (currentPollCount >= MAX_POLLS) {
        logError('Payment verification timeout', 'PaymentCallbackPage', { paymentId, orderId, debugObject });
        setError('Payment verification timeout');
        setTimeout(() => {
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment verification timeout`);
        }, 3000);
        return;
      }
      try {
        const args: Record<string, string> = {};
        if (orderId) args['order_id'] = orderId;
        if (paymentIdArg || paymentId) args['payment_id'] = paymentIdArg || paymentId!;
        const { data, error } = await supabase.functions.invoke("verify-paypal-payment", {
          body: args,
        });
        let result = data;
        if (!data && (orderId || paymentIdArg || paymentId)) {
          // fallback to GET if needed
          const params = new URLSearchParams();
          if (orderId) params.append('order_id', orderId);
          if (paymentIdArg || paymentId) params.append('payment_id', paymentIdArg || paymentId!);
          const apiUrl = `https://fxkqgjakbyrxkmevkglv.supabase.co/functions/v1/verify-paypal-payment?${params.toString()}`;
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!response.ok) {
            const errorText = await response.text();
            logError('API call failed in verify-paypal-payment fallback', 'PaymentCallbackPage', { status: response.status, errorText, debugObject });
            throw new Error(`API call failed: ${response.status} - ${errorText}`);
          }
          result = await response.json();
        }
        handlePaymentStatus(result?.status, currentPollCount, paymentIdArg || paymentId);
      } catch (error: any) {
        logError('Payment verification failed', 'PaymentCallbackPage', { error, paymentId, orderId, debugObject });
        setError(error.message);
        setTimeout(() => {
          navigate(`/payment-failed?planId=${planId || ''}&reason=Payment verification failed: ${error.message}`);
        }, 3000);
      }
    };

    if (success === 'true') {
      (async () => {
        let paymentIdAfterCapture = paymentId;
        try {
          const captureResult = await doCaptureIfNeeded();
          if (captureResult.paymentId) paymentIdAfterCapture = captureResult.paymentId;
        } catch (err) {
          return;
        }
        poll(0, paymentIdAfterCapture);
      })();
    } else {
      poll(0);
    }
    // eslint-disable-next-line
  }, [success, paymentId, orderId, planId, userId, debugObject, navigate, handlePaymentStatus]); 

  return { status, error, pollCount, MAX_POLLS, finalPaymentId };
}
