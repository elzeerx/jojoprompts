import { useEffect, useState, useCallback, useRef } from "react";
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
  hasSessionIndependentData: boolean;
}

// Payment processing state machine
const PROCESSING_STATES = {
  CHECKING: 'checking',
  APPROVED: 'APPROVED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  ERROR: 'ERROR'
};

export function usePaymentProcessing({
  success,
  paymentId,
  orderId,
  planId,
  userId,
  debugObject,
  hasSessionIndependentData
}: UsePaymentProcessingArgs) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>(PROCESSING_STATES.CHECKING);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [finalPaymentId, setFinalPaymentId] = useState<string | undefined>(paymentId);
  const [sessionRestorationAttempted, setSessionRestorationAttempted] = useState(false);
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const MAX_POLLS = 10; // Reduced from 35 for faster timeout

  // ---- ADDED: Track timeouts to clear them when done ----
  const timeoutsRef = useRef<number[]>([]);
  const completeRef = useRef(false);
  const cleanPendingTimeouts = () => {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current = [];
  };

  // Enhanced authentication state management
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authRestorationAttempts, setAuthRestorationAttempts] = useState(0);
  const MAX_AUTH_ATTEMPTS = 3;

  useEffect(() => {
    // Check current auth state with retry logic
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
        console.log(`[PaymentProcessing] Auth check:`, { user: !!user, userId: user?.id });
      } catch (error) {
        console.error(`[PaymentProcessing] Error checking auth state:`, error);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkAuth();

    // Listen for auth changes with enhanced handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[PaymentProcessing] Auth state changed:`, { event, hasSession: !!session });
      setCurrentUser(session?.user || null);
      
      if (event === 'SIGNED_IN' && session?.user && !sessionRestorationAttempted && !isProcessingComplete) {
        console.log(`[PaymentProcessing] Session restored after payment, retrying verification...`);
        setSessionRestorationAttempted(true);
        setStatus(PROCESSING_STATES.CHECKING);
        setPollCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, [sessionRestorationAttempted, isProcessingComplete]);

  // Enhanced database-first verification strategy
  const checkDatabaseFirst = useCallback(async (contextUserId?: string, contextPlanId?: string) => {
    try {
      const finalUserId = contextUserId || currentUser?.id || userId;
      const finalPlanId = contextPlanId || planId;

      if (!finalUserId || !finalPlanId) {
        if (orderId) {
          const { data, error } = await supabase.functions.invoke('get-transaction-by-order', {
            body: { orderId }
          });
          if (!error && data) {
            const { transaction, subscription } = data as any;
            if (subscription) {
              return { hasSubscription: true, transaction, subscription };
            }
            if (transaction && transaction.status === 'completed') {
              return {
                hasSubscription: true,
                transaction,
                subscription: {
                  transaction_id: transaction.id,
                  payment_id: transaction.paypal_payment_id,
                  user_id: transaction.user_id
                }
              };
            }
          }
        }
        return { hasSubscription: false, transaction: null, subscription: null };
      }

      console.log(`[PaymentProcessing] Database-first check:`, { finalUserId, finalPlanId });

      // Check for active subscription first
      const { data: subscription, error: subError } = await supabase
        .from("user_subscriptions")
        .select("id, payment_id, created_at, transaction_id, user_id, status")
        .eq("user_id", finalUserId)
        .eq("plan_id", finalPlanId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (subscription && subscription.length > 0 && !subError) {
        console.log(`[PaymentProcessing] Found active subscription:`, subscription[0]);
        return { hasSubscription: true, subscription: subscription[0], transaction: null };
      }

      // Check for recent completed transactions (last 30 minutes)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentTransaction, error: txError } = await supabase
        .from("transactions")
        .select("id, paypal_payment_id, status, user_id, plan_id, created_at")
        .eq("user_id", finalUserId)
        .eq("plan_id", finalPlanId)
        .eq("status", "completed")
        .gte("created_at", thirtyMinutesAgo)
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentTransaction && recentTransaction.length > 0 && !txError) {
        console.log(`[PaymentProcessing] Found recent completed transaction:`, recentTransaction[0]);
        return { 
          hasSubscription: true, 
          transaction: recentTransaction[0], 
          subscription: { 
            transaction_id: recentTransaction[0].id, 
            payment_id: recentTransaction[0].paypal_payment_id, 
            user_id: recentTransaction[0].user_id 
          } 
        };
      }

    } catch (error) {
      console.error(`[PaymentProcessing] Database check error:`, error);
    }
    
    return { hasSubscription: false, transaction: null, subscription: null };
  }, [currentUser?.id, userId, planId, orderId]);

  // Enhanced transaction recovery with order matching
  const findTransactionByOrder = useCallback(async (orderIdToFind: string) => {
    try {
      if (!currentUser) {
        const { data, error } = await supabase.functions.invoke('get-transaction-by-order', {
          body: { orderId: orderIdToFind }
        });
        if (!error && data && (data as any).transaction) {
          return (data as any).transaction;
        }
        return null;
      }

      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("user_id, plan_id, paypal_payment_id, status, created_at, id")
        .eq("paypal_order_id", orderIdToFind)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error || !transactions || transactions.length === 0) {
        console.log(`[PaymentProcessing] No transaction found for order:`, orderIdToFind);
        return null;
      }

      const transaction = transactions[0];
      console.log(`[PaymentProcessing] Found transaction for order:`, { orderIdToFind, transaction });
      return transaction;
    } catch (error) {
      console.error(`[PaymentProcessing] Error finding transaction by order:`, error);
      return null;
    }
  }, [currentUser]);

  // Enhanced session restoration with intelligent retry
  const attemptSessionRestoration = useCallback(async (transactionUserId?: string) => {
    if (currentUser || authRestorationAttempts >= MAX_AUTH_ATTEMPTS) {
      return false;
    }

    console.log(`[PaymentProcessing] Attempting session restoration (attempt ${authRestorationAttempts + 1})`);
    setAuthRestorationAttempts(prev => prev + 1);

    try {
      // Check if there's a stored session that can be restored
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session?.user) {
        console.log(`[PaymentProcessing] Session restored successfully`);
        setCurrentUser(session.user);
        return true;
      }

      // Attempt restoration from localStorage backup created before PayPal redirection
      const backupRaw = localStorage.getItem('payPalSessionBackup');
      if (backupRaw) {
        try {
          const tokens = JSON.parse(backupRaw);
          if (tokens?.access_token && tokens?.refresh_token) {
            const { data: restored, error: restoreError } = await supabase.auth.setSession({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token
            });
            if (!restoreError && restored.session?.user) {
              console.log('[PaymentProcessing] Session restored from backup');
              setCurrentUser(restored.session.user);
              localStorage.removeItem('payPalSessionBackup');
              return true;
            }
          }
        } catch (parseError) {
          console.error('[PaymentProcessing] Failed to restore session backup:', parseError);
          localStorage.removeItem('payPalSessionBackup');
        }
      }

      // If we know the user ID from transaction, we can proceed without session
      if (transactionUserId) {
        console.log(`[PaymentProcessing] Proceeding with transaction user ID:`, transactionUserId);
        return true;
      }

    } catch (error) {
      console.error(`[PaymentProcessing] Error during session restoration:`, error);
    }

    return false;
  }, [currentUser, authRestorationAttempts]);

  // Enhanced status handling with proper state management
  const handlePaymentStatus = useCallback((paymentStatus: string, currentPollCount: number, paymentIdForSuccess?: string, contextUserId?: string, contextPlanId?: string) => {
    if (completeRef.current || isProcessingComplete) {
      console.log(`[PaymentProcessing] Processing already complete, ignoring status:`, paymentStatus);
      return;
    }
    setStatus(paymentStatus);
    setPollCount(currentPollCount + 1);
    completeRef.current = true; // Mark as finished
    cleanPendingTimeouts();     // Prevent any queued redirects

    const finalUserId = contextUserId || currentUser?.id || userId;
    const finalPlanId = contextPlanId || planId;

    if (paymentStatus === PROCESSING_STATES.COMPLETED) {
      setIsProcessingComplete(true);

      const successParams = new URLSearchParams();
      if (finalPlanId) successParams.append('planId', finalPlanId);
      if (finalUserId) successParams.append('userId', finalUserId);
      if (paymentIdForSuccess) successParams.append('payment_id', paymentIdForSuccess);
      if (orderId) successParams.append('order_id', orderId);

      console.log(`[PaymentProcessing] Redirecting to success page:`, successParams.toString());
      navigate(`/payment-success?${successParams.toString()}`);
    } else if ([PROCESSING_STATES.FAILED, PROCESSING_STATES.CANCELLED, 'DECLINED', 'VOIDED'].includes(paymentStatus)) {
      setIsProcessingComplete(true);

      const failedParams = new URLSearchParams();
      if (finalPlanId) failedParams.append('planId', finalPlanId);
      failedParams.append('reason', `Payment ${paymentStatus.toLowerCase()}`);
      failedParams.append('status', paymentStatus);
      if (paymentIdForSuccess) failedParams.append('payment_id', paymentIdForSuccess);

      logError('Payment flow failed', 'PaymentCallbackPage', { paymentStatus, debugObject });
      navigate(`/payment-failed?${failedParams.toString()}`);
    }
  }, [planId, currentUser?.id, userId, orderId, navigate, debugObject, isProcessingComplete]);

  useEffect(() => {
    if (isLoadingAuth || isProcessingComplete) return;

    // Clean pending timeouts if effect re-runs
    cleanPendingTimeouts();

    // Handle cancelled payments immediately
    if (success === 'false') {
      logError('PayPal payment cancelled', 'PaymentCallbackPage', { debugObject });
      setError('Payment was cancelled');
      const timeoutId = window.setTimeout(() => {
        navigate(`/payment-failed?planId=${planId || ''}&reason=Payment cancelled`);
      }, 2000);
      timeoutsRef.current.push(timeoutId);
      return;
    }

    // Validate required payment identifiers
    if (!orderId && !paymentId) {
      logError('No PayPal payment identifier found in URL parameters', 'PaymentCallbackPage', { debugObject });
      setError('Missing payment information in callback URL');
      const timeoutId = window.setTimeout(() => {
        navigate(`/payment-failed?planId=${planId || ''}&reason=Missing payment reference`);
      }, 2000);
      timeoutsRef.current.push(timeoutId);
      return;
    }

    // Polling logic with timeout cleanup
    const poll = async (currentPollCount: number = 0, paymentIdArg?: string, contextUserId?: string, contextPlanId?: string) => {
      if (completeRef.current || isProcessingComplete) {
        console.log(`[PaymentProcessing] Processing complete, stopping poll`);
        cleanPendingTimeouts();
        return;
      }

      if (currentPollCount >= MAX_POLLS) {
        // Final database check before timeout
        const { hasSubscription, subscription } = await checkDatabaseFirst(contextUserId, contextPlanId);
        if (hasSubscription) {
          console.log(`[PaymentProcessing] Found subscription on final timeout check, treating as success`);
          handlePaymentStatus(PROCESSING_STATES.COMPLETED, currentPollCount, subscription?.payment_id || paymentIdArg || paymentId || undefined, contextUserId || subscription?.user_id, contextPlanId);
          return;
        }

        logError('Payment verification timeout', 'PaymentCallbackPage', { paymentId, orderId, debugObject });
        setError('Payment verification timeout. Please contact support if your payment was successful.');
        const timeoutId = window.setTimeout(() => {
          navigate(`/payment-failed?planId=${contextPlanId || planId || ''}&reason=Payment verification timeout`);
        }, 2000);
        timeoutsRef.current.push(timeoutId);
        return;
      }

      try {
        // Database-first verification
        const { hasSubscription, subscription } = await checkDatabaseFirst(contextUserId, contextPlanId);
        if (hasSubscription) {
          setStatus(PROCESSING_STATES.COMPLETED);
          setFinalPaymentId(subscription?.payment_id || paymentIdArg || paymentId || undefined);
          handlePaymentStatus(PROCESSING_STATES.COMPLETED, currentPollCount, subscription?.payment_id || paymentIdArg || paymentId || undefined, contextUserId || subscription?.user_id, contextPlanId);
          return;
        }

        // Context recovery
        let currentUserId = contextUserId || currentUser?.id || userId;
        let currentPlanId = contextPlanId || planId;

        if ((!currentUserId || !currentPlanId) && orderId) {
          const transaction = await findTransactionByOrder(orderId);
          if (transaction) {
            currentUserId = transaction.user_id;
            currentPlanId = transaction.plan_id;
            await attemptSessionRestoration(currentUserId);
          }
        }

        // PayPal API verification
        const args: Record<string, string> = {};
        if (orderId) args['order_id'] = orderId;
        if (paymentIdArg || paymentId) args['payment_id'] = paymentIdArg || paymentId!;
        if (currentUserId) args['user_id'] = currentUserId;
        if (currentPlanId) args['plan_id'] = currentPlanId;

        const { data, error } = await supabase.functions.invoke("verify-paypal-payment", {
          body: args,
        });

        if (!data || data.status === "ERROR" || error) {
          // Continue polling for transient issues with exponential backoff
          if (currentPollCount < MAX_POLLS - 5) {
            const delay = Math.min(2000 * Math.pow(1.5, Math.floor(currentPollCount / 5)), 10000);
            const timeoutId = window.setTimeout(() => poll(currentPollCount + 1, paymentIdArg, currentUserId, currentPlanId), delay);
            timeoutsRef.current.push(timeoutId);
            return;
          } else {
            setError('Unable to verify payment status. Please contact support if your payment was successful.');
            logError("Payment verification failed after multiple attempts", "PaymentCallbackPage", { debugObject, result: data, currentPollCount });
            const timeoutId = window.setTimeout(() => {
              navigate(`/payment-failed?planId=${currentPlanId || ''}&reason=Payment verification failed`);
            }, 2000);
            timeoutsRef.current.push(timeoutId);
            return;
          }
        }

        if (data.status === "UNKNOWN") {
          if (currentPollCount < MAX_POLLS - 5) {
            const timeoutId = window.setTimeout(() => poll(currentPollCount + 1, paymentIdArg, currentUserId, currentPlanId), 2000);
            timeoutsRef.current.push(timeoutId);
            return;
          }
        }

        if (data.status === "APPROVED" && orderId && currentPollCount < MAX_POLLS) {
          const timeoutId = window.setTimeout(() => poll(currentPollCount + 1, paymentIdArg, currentUserId, currentPlanId), 1500);
          timeoutsRef.current.push(timeoutId);
          return;
        }

        // Extract payment ID and handle final status
        const paymentIdOut = data.paymentId || data.paypal?.purchase_units?.[0]?.payments?.captures?.[0]?.id || data.paypal?.id || data.paypal_payment_id || paymentIdArg || paymentId || undefined;
        setFinalPaymentId(paymentIdOut);

        handlePaymentStatus(data.status, currentPollCount, paymentIdOut, currentUserId, currentPlanId);

      } catch (error: any) {
        // Always check for subscription even on errors (database resilience)
        const { hasSubscription, subscription } = await checkDatabaseFirst(contextUserId, contextPlanId);
        if (hasSubscription) {
          setStatus(PROCESSING_STATES.COMPLETED);
          setFinalPaymentId(subscription?.payment_id || paymentId || undefined);
          handlePaymentStatus(PROCESSING_STATES.COMPLETED, currentPollCount, subscription?.payment_id || paymentId || undefined, contextUserId || subscription?.user_id, contextPlanId);
          return;
        }

        // Retry logic for transient errors
        if (currentPollCount >= 3) {
          setError('Payment verification failed. Please contact support if your payment was successful.');
          logError('Payment verification failed', 'PaymentCallbackPage', { error, paymentId, orderId, debugObject });
          const timeoutId = window.setTimeout(() => {
            navigate(`/payment-failed?planId=${contextPlanId || planId || ''}&reason=Payment verification failed`);
          }, 2000);
          timeoutsRef.current.push(timeoutId);
        } else {
          const timeoutId = window.setTimeout(() => poll(currentPollCount + 1, paymentIdArg, contextUserId, contextPlanId), 2000);
          timeoutsRef.current.push(timeoutId);
        }
      }
    };

    // Start processing with session-independent data
    if (success === 'true' || hasSessionIndependentData) {
      poll(0, paymentId, currentUser?.id || userId, planId);
    } else {
      poll(0, undefined, currentUser?.id || userId, planId);
    }

    // CLEANUP: cancel all pending timeouts on unmount or rerun
    return () => {
      completeRef.current = false;
      cleanPendingTimeouts();
    };
  }, [success, paymentId, orderId, planId, userId, debugObject, navigate, handlePaymentStatus, checkDatabaseFirst, findTransactionByOrder, currentUser, isLoadingAuth, hasSessionIndependentData, attemptSessionRestoration, isProcessingComplete]);

  return { status, error, pollCount, MAX_POLLS, finalPaymentId };
}
