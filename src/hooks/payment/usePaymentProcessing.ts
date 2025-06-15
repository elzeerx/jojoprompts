
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

  // ENHANCED: Intelligent transaction recovery when user context is missing
  const findTransactionByOrder = useCallback(async (orderIdToFind: string) => {
    try {
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("user_id, plan_id, paypal_payment_id, status")
        .eq("paypal_order_id", orderIdToFind)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error || !transactions || transactions.length === 0) {
        console.log('No transaction found for order:', orderIdToFind);
        return null;
      }

      const transaction = transactions[0];
      console.log('Found transaction for order:', { orderIdToFind, transaction });
      return transaction;
    } catch (error) {
      console.error('Error finding transaction by order:', error);
      return null;
    }
  }, []);

  // ENHANCED: Fallback subscription check with better error handling
  const fallbackCheckSubscription = useCallback(async (userIdToCheck?: string, planIdToCheck?: string) => {
    const finalUserId = userIdToCheck || userId;
    const finalPlanId = planIdToCheck || planId;
    
    if (finalUserId && finalPlanId) {
      try {
        const { data, error } = await supabase
          .from("user_subscriptions")
          .select("id, payment_id, created_at")
          .eq("user_id", finalUserId)
          .eq("plan_id", finalPlanId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (data && data.length > 0 && !error) {
          console.log('Found active subscription:', data[0]);
          return { hasSubscription: true, subscription: data[0] };
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    }
    return { hasSubscription: false, subscription: null };
  }, [userId, planId]);

  const handlePaymentStatus = useCallback((paymentStatus: string, currentPollCount: number, paymentIdForSuccessParam?: string, contextUserId?: string, contextPlanId?: string) => {
    setStatus(paymentStatus);
    setPollCount(currentPollCount + 1);

    const finalUserId = contextUserId || userId;
    const finalPlanId = contextPlanId || planId;

    if (paymentStatus === 'COMPLETED') {
      const successParams = new URLSearchParams();
      if (finalPlanId) successParams.append('planId', finalPlanId);
      if (finalUserId) successParams.append('userId', finalUserId);
      if (paymentIdForSuccessParam) successParams.append('payment_id', paymentIdForSuccessParam);
      if (orderId) successParams.append('order_id', orderId);
      navigate(`/payment-success?${successParams.toString()}`);
    } else if (['FAILED', 'DECLINED', 'CANCELLED', 'VOIDED', 'ERROR'].includes(paymentStatus)) {
      const failedParams = new URLSearchParams();
      if (finalPlanId) failedParams.append('planId', finalPlanId);
      failedParams.append('reason', `Payment ${paymentStatus.toLowerCase()}`);
      failedParams.append('status', paymentStatus);
      if (paymentIdForSuccessParam) failedParams.append('payment_id', paymentIdForSuccessParam);

      logError('Payment flow failed', 'PaymentCallbackPage', { paymentStatus, debugObject });
      navigate(`/payment-failed?${failedParams.toString()}`);
    }
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

    const poll = async (currentPollCount: number = 0, paymentIdArg?: string, contextUserId?: string, contextPlanId?: string) => {
      if (currentPollCount >= MAX_POLLS) {
        // ENHANCED: Final attempt with subscription check before timeout
        const { hasSubscription } = await fallbackCheckSubscription(contextUserId, contextPlanId);
        if (hasSubscription) {
          console.log('Found subscription on final timeout check, treating as success');
          handlePaymentStatus('COMPLETED', currentPollCount, paymentIdArg || paymentId || undefined, contextUserId, contextPlanId);
          return;
        }

        logError('Payment verification timeout', 'PaymentCallbackPage', { paymentId, orderId, debugObject });
        setError('Payment verification timeout (PayPal sometimes needs several minutes to confirm). Please contact support with your order ID.');
        setTimeout(() => {
          navigate(`/payment-failed?planId=${contextPlanId || planId || ''}&reason=Payment verification timeout`);
        }, 3000);
        return;
      }

      try {
        const args: Record<string, string> = {};
        if (orderId) args['order_id'] = orderId;
        if (paymentIdArg || paymentId) args['payment_id'] = paymentIdArg || paymentId!;

        console.log(`Payment verification attempt ${currentPollCount + 1}/${MAX_POLLS}:`, args);

        const { data, error } = await supabase.functions.invoke("verify-paypal-payment", {
          body: args,
        });

        let result = data;
        let currentUserId = contextUserId || userId;
        let currentPlanId = contextPlanId || planId;

        // ENHANCED: Handle missing user context by looking up transaction
        if ((!currentUserId || !currentPlanId) && orderId) {
          console.log('Missing user context, attempting transaction lookup...');
          const transaction = await findTransactionByOrder(orderId);
          if (transaction) {
            currentUserId = transaction.user_id;
            currentPlanId = transaction.plan_id;
            console.log('Recovered user context from transaction:', { currentUserId, currentPlanId });
          }
        }

        // ENHANCED: Better handling of verification responses
        if (!result || !result.status || result.status === "UNKNOWN" || error) {
          console.log('Verification returned unclear status, checking for subscription fallback...');
          
          const { hasSubscription, subscription } = await fallbackCheckSubscription(currentUserId, currentPlanId);
          if (hasSubscription) {
            console.log('Found active subscription despite verification issues, treating as success');
            setStatus('COMPLETED');
            setFinalPaymentId(subscription?.payment_id || paymentIdArg || paymentId || undefined);

            const successParams = new URLSearchParams();
            if (currentPlanId) successParams.append('planId', currentPlanId);
            if (currentUserId) successParams.append('userId', currentUserId);
            if (subscription?.payment_id) successParams.append('payment_id', subscription.payment_id);
            if (orderId) successParams.append('order_id', orderId);
            navigate(`/payment-success?${successParams.toString()}`);
            return;
          }

          // Only set error if we've tried multiple times and found no subscription
          if (currentPollCount >= 3) {
            setError('Could not verify payment status with PayPal.');
            logError("Unable to determine payment status after multiple attempts", "PaymentCallbackPage", { debugObject, result, currentPollCount });
            setTimeout(() => {
              navigate(`/payment-failed?planId=${currentPlanId || ''}&reason=Unable to determine payment status`);
            }, 3500);
            return;
          } else {
            // Continue polling for transient issues
            console.log('Verification unclear, continuing to poll...');
            setTimeout(() => poll(currentPollCount + 1, paymentIdArg, currentUserId, currentPlanId), 2000);
            return;
          }
        }

        // If status is APPROVED and not yet captured, poll again
        if (result.status === "APPROVED" && orderId && currentPollCount < MAX_POLLS) {
          console.log('Payment approved but not captured, continuing to poll...');
          setTimeout(() => poll(currentPollCount + 1, paymentIdArg, currentUserId, currentPlanId), 1800);
          return;
        }

        // Enhanced paymentId extraction
        const paymentIdOut =
          result.paymentId ||
          result.paypal?.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
          result.paypal?.id ||
          result.paypal_payment_id ||
          paymentIdArg ||
          paymentId ||
          undefined;

        setFinalPaymentId(paymentIdOut);

        console.log('Payment verification successful:', {
          status: result.status,
          paymentId: paymentIdOut,
          userId: currentUserId,
          planId: currentPlanId
        });

        handlePaymentStatus(result.status, currentPollCount, paymentIdOut, currentUserId, currentPlanId);

      } catch (error: any) {
        console.error('Payment verification error:', error);
        
        // ENHANCED: Fallback check even on errors
        const { hasSubscription, subscription } = await fallbackCheckSubscription(contextUserId, contextPlanId);
        if (hasSubscription) {
          console.log('Found subscription despite verification error, treating as success');
          setStatus('COMPLETED');
          setFinalPaymentId(subscription?.payment_id || paymentId || undefined);
          const successParams = new URLSearchParams();
          if (contextPlanId || planId) successParams.append('planId', contextPlanId || planId!);
          if (contextUserId || userId) successParams.append('userId', contextUserId || userId!);
          if (subscription?.payment_id) successParams.append('payment_id', subscription.payment_id);
          if (orderId) successParams.append('order_id', orderId);
          navigate(`/payment-success?${successParams.toString()}`);
          return;
        }

        logError('Payment verification failed', 'PaymentCallbackPage', { error, paymentId, orderId, debugObject });
        setError(error.message || "Payment verification failed");
        setTimeout(() => {
          navigate(`/payment-failed?planId=${contextPlanId || planId || ''}&reason=Payment verification failed: ${error.message || "unknown error"}`);
        }, 3000);
      }
    };

    if (success === 'true') {
      poll(0, paymentId, userId, planId);
    } else {
      poll(0, undefined, userId, planId);
    }
  }, [success, paymentId, orderId, planId, userId, debugObject, navigate, handlePaymentStatus, fallbackCheckSubscription, findTransactionByOrder]); 

  return { status, error, pollCount, MAX_POLLS, finalPaymentId };
}
