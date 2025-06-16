
import { useEffect, useState, useCallback, useRef } from "react";
import { PROCESSING_STATES } from "./constants/paymentProcessingConstants";
import { checkDatabaseFirst } from "./utils/databaseVerification";
import { findTransactionByOrder } from "./utils/transactionRecovery";
import { attemptSessionRestoration } from "./utils/sessionRestoration";
import { useTimeoutManager } from "./utils/timeoutManager";
import { usePaymentStatusHandler } from "./utils/paymentStatusHandler";
import { UsePaymentProcessingArgs } from "./types/paymentProcessingTypes";
import { supabase } from "@/integrations/supabase/client";

export function usePaymentProcessing({
  success,
  paymentId,
  orderId,
  planId,
  userId,
  debugObject,
  hasSessionIndependentData,
}: UsePaymentProcessingArgs) {
  const [status, setStatus] = useState<string>(PROCESSING_STATES.CHECKING);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [finalPaymentId, setFinalPaymentId] = useState<string | undefined>(paymentId);
  const [sessionRestorationAttempted, setSessionRestorationAttempted] = useState(false);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const MAX_POLLS = 10;
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authRestorationAttempts, setAuthRestorationAttempts] = useState(0);
  const MAX_AUTH_ATTEMPTS = 3;

  // Timeout manager
  const { timeoutsRef, addTimeout, clean } = useTimeoutManager();

  const completeRef = useRef(false);

  // Status handler
  const handlePaymentStatus = usePaymentStatusHandler({ planId, userId, orderId, debugObject });

  // Helper function to map camelCase to snake_case parameters for backend
  const mapParametersForBackend = useCallback((params: Record<string, string>) => {
    const mappedParams: Record<string, string> = {};
    
    // Map camelCase to snake_case for backend compatibility
    if (params.orderId) mappedParams['order_id'] = params.orderId;
    if (params.paymentId) mappedParams['payment_id'] = params.paymentId;
    if (params.userId) mappedParams['user_id'] = params.userId;
    if (params.planId) mappedParams['plan_id'] = params.planId;
    
    // Also include original parameters for backwards compatibility
    Object.keys(params).forEach(key => {
      if (!mappedParams[key]) {
        mappedParams[key] = params[key];
      }
    });

    console.log('Parameter mapping for backend:', {
      original: params,
      mapped: mappedParams
    });

    return mappedParams;
  }, []);

  // Auth load effect
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
      } catch {}
      setIsLoadingAuth(false);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user || null);
      if (event === 'SIGNED_IN' && session?.user && !sessionRestorationAttempted && !isProcessingComplete) {
        setSessionRestorationAttempted(true);
        setStatus(PROCESSING_STATES.CHECKING);
        setPollCount(0);
      }
    });
    return () => subscription.unsubscribe();
  }, [sessionRestorationAttempted, isProcessingComplete]);

  useEffect(() => {
    if (isLoadingAuth || isProcessingComplete) return;
    clean();

    if (success === 'false') {
      setError('Payment was cancelled');
      const timeoutId = window.setTimeout(() => {
        handlePaymentStatus(PROCESSING_STATES.CANCELLED);
      }, 2000);
      addTimeout(timeoutId);
      return;
    }

    if (!orderId && !paymentId) {
      console.error('Missing payment information:', { orderId, paymentId, debugObject });
      setError('Missing payment information in callback URL');
      const timeoutId = window.setTimeout(() => {
        handlePaymentStatus(PROCESSING_STATES.FAILED);
      }, 2000);
      addTimeout(timeoutId);
      return;
    }

    const poll = async (currentPollCount: number = 0, paymentIdArg?: string, contextUserId?: string, contextPlanId?: string) => {
      if (completeRef.current || isProcessingComplete) {
        clean();
        return;
      }

      if (currentPollCount >= MAX_POLLS) {
        const { hasSubscription, subscription } = await checkDatabaseFirst({ userId: contextUserId || currentUser?.id || userId, planId: contextPlanId || planId, orderId });
        if (hasSubscription) {
          handlePaymentStatus(PROCESSING_STATES.COMPLETED, subscription?.payment_id || paymentIdArg || paymentId, contextUserId || subscription?.user_id, contextPlanId);
          setIsProcessingComplete(true);
          return;
        }
        setError('Payment verification timeout. Please contact support if your payment was successful.');
        const timeoutId = window.setTimeout(() => {
          handlePaymentStatus(PROCESSING_STATES.FAILED, undefined, contextUserId, contextPlanId);
        }, 2000);
        addTimeout(timeoutId);
        return;
      }

      try {
        const { hasSubscription, subscription } = await checkDatabaseFirst({ userId: contextUserId || currentUser?.id || userId, planId: contextPlanId || planId, orderId });
        if (hasSubscription) {
          setStatus(PROCESSING_STATES.COMPLETED);
          setFinalPaymentId(subscription?.payment_id || paymentIdArg || paymentId);
          handlePaymentStatus(PROCESSING_STATES.COMPLETED, subscription?.payment_id || paymentIdArg || paymentId, contextUserId || subscription?.user_id, contextPlanId);
          setIsProcessingComplete(true);
          return;
        }

        let currentUserId = contextUserId || currentUser?.id || userId;
        let currentPlanId = contextPlanId || planId;

        if ((!currentUserId || !currentPlanId) && orderId) {
          const transaction = await findTransactionByOrder(orderId, currentUser);
          if (transaction) {
            currentUserId = transaction.user_id;
            currentPlanId = transaction.plan_id;
            await attemptSessionRestoration(currentUser, authRestorationAttempts, MAX_AUTH_ATTEMPTS, setCurrentUser, currentUserId);
          }
        }

        // Prepare parameters with proper snake_case mapping for backend
        const originalParams: Record<string, string> = {};
        if (orderId) originalParams['orderId'] = orderId;
        if (paymentIdArg || paymentId) originalParams['paymentId'] = paymentIdArg || paymentId!;
        if (currentUserId) originalParams['userId'] = currentUserId;
        if (currentPlanId) originalParams['planId'] = currentPlanId;

        const backendParams = mapParametersForBackend(originalParams);

        console.log('Calling verify-paypal-payment with parameters:', backendParams);

        const { data, error } = await supabase.functions.invoke("verify-paypal-payment", { body: backendParams });
        
        if (!data || data.status === "ERROR" || error) {
          console.error('Payment verification error:', { data, error, params: backendParams });
          if (currentPollCount < MAX_POLLS - 5) {
            const delay = Math.min(2000 * Math.pow(1.5, Math.floor(currentPollCount / 5)), 10000);
            const timeoutId = window.setTimeout(() => poll(currentPollCount + 1, paymentIdArg, currentUserId, currentPlanId), delay);
            addTimeout(timeoutId);
            return;
          } else {
            setError('Unable to verify payment status. Please contact support if your payment was successful.');
            const timeoutId = window.setTimeout(() => {
              handlePaymentStatus(PROCESSING_STATES.FAILED, undefined, currentUserId, currentPlanId);
            }, 2000);
            addTimeout(timeoutId);
            return;
          }
        }

        if (data.status === "UNKNOWN") {
          if (currentPollCount < MAX_POLLS - 5) {
            const timeoutId = window.setTimeout(() => poll(currentPollCount + 1, paymentIdArg, currentUserId, currentPlanId), 2000);
            addTimeout(timeoutId);
            return;
          }
        }

        if (data.status === "APPROVED" && orderId && currentPollCount < MAX_POLLS) {
          const timeoutId = window.setTimeout(() => poll(currentPollCount + 1, paymentIdArg, currentUserId, currentPlanId), 1500);
          addTimeout(timeoutId);
          return;
        }

        const paymentIdOut = data.paymentId || data.paypal?.purchase_units?.[0]?.payments?.captures?.[0]?.id || data.paypal?.id || data.paypal_payment_id || paymentIdArg || paymentId || undefined;
        setFinalPaymentId(paymentIdOut);

        handlePaymentStatus(data.status, paymentIdOut, currentUserId, currentPlanId);

      } catch (error: any) {
        console.error('Payment verification exception:', error);
        const { hasSubscription, subscription } = await checkDatabaseFirst({ userId: contextUserId || currentUser?.id || userId, planId: contextPlanId || planId, orderId });
        if (hasSubscription) {
          setStatus(PROCESSING_STATES.COMPLETED);
          setFinalPaymentId(subscription?.payment_id || paymentId);
          handlePaymentStatus(PROCESSING_STATES.COMPLETED, subscription?.payment_id || paymentId, contextUserId || subscription?.user_id, contextPlanId);
          setIsProcessingComplete(true);
          return;
        }

        if (currentPollCount >= 3) {
          setError('Payment verification failed. Please contact support if your payment was successful.');
          const timeoutId = window.setTimeout(() => {
            handlePaymentStatus(PROCESSING_STATES.FAILED, undefined, contextUserId, contextPlanId);
          }, 2000);
          addTimeout(timeoutId);
        } else {
          const timeoutId = window.setTimeout(() => poll(currentPollCount + 1, paymentIdArg, contextUserId, contextPlanId), 2000);
          addTimeout(timeoutId);
        }
      }
    };

    if (success === 'true' || hasSessionIndependentData) {
      poll(0, paymentId, currentUser?.id || userId, planId);
    } else {
      poll(0, undefined, currentUser?.id || userId, planId);
    }

    return () => {
      completeRef.current = false;
      clean();
    };
  }, [success, paymentId, orderId, planId, userId, debugObject, handlePaymentStatus, currentUser, isLoadingAuth, hasSessionIndependentData, isProcessingComplete, mapParametersForBackend]);

  return { status, error, pollCount, MAX_POLLS, finalPaymentId };
}
