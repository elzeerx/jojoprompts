
import { useEffect, useState, useCallback, useRef } from "react";
import { PROCESSING_STATES } from "./constants/paymentProcessingConstants";
import { checkDatabaseFirst } from "./utils/databaseVerification";
import { findTransactionByOrder } from "./utils/transactionRecovery";
import { useTimeoutManager } from "./utils/timeoutManager";
import { usePaymentStatusHandler } from "./utils/paymentStatusHandler";
import { UsePaymentProcessingArgs } from "./types/paymentProcessingTypes";
import { SessionManager } from "./helpers/sessionManager";
import { PaymentStateVerifier } from "./helpers/paymentStateVerifier";
import { EnhancedPaymentNavigator } from "./helpers/enhancedPaymentNavigator";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

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
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const MAX_POLLS = 10;
  const navigate = useNavigate();

  // Timeout manager
  const { timeoutsRef, addTimeout, clean } = useTimeoutManager();
  const completeRef = useRef(false);

  // Enhanced session and payment context recovery
  useEffect(() => {
    const initializePaymentFlow = async () => {
      console.log('Initializing payment flow with session recovery');
      
      // Attempt session restoration first
      const sessionResult = await SessionManager.restoreSession();
      
      if (sessionResult.success && sessionResult.user) {
        setCurrentUser(sessionResult.user);
        console.log('Session restored successfully');
        
        // If we have payment context from the restored session, use it
        if (sessionResult.context) {
          const { userId: contextUserId, planId: contextPlanId, orderId: contextOrderId } = sessionResult.context;
          
          // Immediately verify payment state with restored context
          const verificationResult = await PaymentStateVerifier.verifyPaymentState(
            contextUserId || userId,
            contextPlanId || planId,
            contextOrderId || orderId,
            paymentId
          );

          if (verificationResult.isSuccessful && verificationResult.hasActiveSubscription) {
            console.log('Payment already successful, redirecting to success');
            setStatus(PROCESSING_STATES.COMPLETED);
            setIsProcessingComplete(true);
            
            EnhancedPaymentNavigator.navigateBasedOnPaymentState({
              navigate,
              userId: contextUserId || userId,
              planId: contextPlanId || planId,
              orderId: contextOrderId || orderId,
              paymentId
            }, verificationResult);
            return;
          }
        }
      }
      
      // Fallback to regular auth check
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
      } catch (err) {
        console.error('Auth check failed:', err);
      }
      
      setIsLoadingAuth(false);
    };

    initializePaymentFlow();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user || null);
      if (event === 'SIGNED_IN' && session?.user && !isProcessingComplete) {
        setStatus(PROCESSING_STATES.CHECKING);
        setPollCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  // Enhanced payment processing with database-first verification
  useEffect(() => {
    if (isLoadingAuth || isProcessingComplete) return;
    clean();

    if (success === 'false') {
      setError('Payment was cancelled');
      const timeoutId = window.setTimeout(() => {
        const failedParams = new URLSearchParams();
        if (planId) failedParams.append('planId', planId);
        failedParams.append('reason', 'Payment was cancelled');
        failedParams.append('status', 'CANCELLED');
        navigate(`/payment-failed?${failedParams.toString()}`);
      }, 2000);
      addTimeout(timeoutId);
      return;
    }

    const processPayment = async () => {
      // Phase 1: Database-first verification
      console.log('Starting database-first payment verification');
      const verificationResult = await PaymentStateVerifier.verifyPaymentState(
        currentUser?.id || userId,
        planId,
        orderId,
        paymentId
      );

      if (verificationResult.isSuccessful && verificationResult.hasActiveSubscription) {
        console.log('Database verification: Payment successful, subscription active');
        setStatus(PROCESSING_STATES.COMPLETED);
        setFinalPaymentId(verificationResult.subscription?.payment_id || paymentId);
        setIsProcessingComplete(true);
        
        EnhancedPaymentNavigator.navigateBasedOnPaymentState({
          navigate,
          userId: currentUser?.id || userId,
          planId,
          orderId,
          paymentId: verificationResult.subscription?.payment_id || paymentId
        }, verificationResult);
        return;
      }

      // Phase 2: Check if this is a discount-based payment (no PayPal verification needed)
      const { hasSubscription, subscription } = await checkDatabaseFirst({ 
        userId: currentUser?.id || userId, 
        planId, 
        orderId 
      });
      
      if (hasSubscription && subscription) {
        // Check if this is a discount-based payment
        const isDiscountPayment = subscription.payment_method === 'discount_100_percent' || 
                                 (subscription.payment_id && subscription.payment_id.startsWith('discount_'));
        
        if (isDiscountPayment) {
          console.log('Discount-based payment detected, redirecting to success');
          setStatus(PROCESSING_STATES.COMPLETED);
          setFinalPaymentId(subscription.payment_id);
          setIsProcessingComplete(true);
          
          EnhancedPaymentNavigator.navigateBasedOnPaymentState({
            navigate,
            userId: currentUser?.id || userId,
            planId,
            orderId,
            paymentId: subscription.payment_id
          }, {
            isSuccessful: true,
            hasActiveSubscription: true,
            needsAuthentication: false
          });
          return;
        }
      }

      // Phase 3: If not discount payment and database verification is inconclusive, proceed with PayPal API verification
      if (!orderId && !paymentId) {
        console.error('Missing payment information:', { orderId, paymentId, debugObject });
        setError('Missing payment information in callback URL');
        
        EnhancedPaymentNavigator.navigateBasedOnPaymentState({
          navigate, userId, planId, orderId, paymentId
        }, {
          isSuccessful: false,
          hasActiveSubscription: false,
          needsAuthentication: false,
          errorMessage: 'Missing payment information'
        });
        return;
      }

      // Continue with existing polling logic but with enhanced error handling
      const poll = async (currentPollCount: number = 0, paymentIdArg?: string, contextUserId?: string, contextPlanId?: string) => {
        if (completeRef.current || isProcessingComplete) {
          clean();
          return;
        }

        if (currentPollCount >= MAX_POLLS) {
          const { hasSubscription, subscription } = await checkDatabaseFirst({ userId: contextUserId || currentUser?.id || userId, planId: contextPlanId || planId, orderId });
          if (hasSubscription) {
            setStatus(PROCESSING_STATES.COMPLETED);
            setFinalPaymentId(subscription?.payment_id || paymentIdArg || paymentId);
            setIsProcessingComplete(true);
            
            EnhancedPaymentNavigator.navigateBasedOnPaymentState({
              navigate,
              userId: contextUserId || currentUser?.id || userId,
              planId: contextPlanId || planId,
              orderId,
              paymentId: subscription?.payment_id || paymentIdArg || paymentId
            }, {
              isSuccessful: true,
              hasActiveSubscription: true,
              needsAuthentication: false
            });
            return;
          }
          
          setError('Payment verification timeout. Please contact support if your payment was successful.');
          EnhancedPaymentNavigator.navigateBasedOnPaymentState({
            navigate, userId: contextUserId, planId: contextPlanId, orderId, paymentId: paymentIdArg
          }, {
            isSuccessful: false,
            hasActiveSubscription: false,
            needsAuthentication: false,
            errorMessage: 'Payment verification timeout'
          });
          return;
        }

        try {
          const { hasSubscription, subscription } = await checkDatabaseFirst({ userId: contextUserId || currentUser?.id || userId, planId: contextPlanId || planId, orderId });
          if (hasSubscription) {
            setStatus(PROCESSING_STATES.COMPLETED);
            setFinalPaymentId(subscription?.payment_id || paymentIdArg || paymentId);
            setIsProcessingComplete(true);
            
            EnhancedPaymentNavigator.navigateBasedOnPaymentState({
              navigate,
              userId: contextUserId || currentUser?.id || userId,
              planId: contextPlanId || planId,
              orderId,
              paymentId: subscription?.payment_id || paymentIdArg || paymentId
            }, {
              isSuccessful: true,
              hasActiveSubscription: true,
              needsAuthentication: false
            });
            return;
          }

          let currentUserId = contextUserId || currentUser?.id || userId;
          let currentPlanId = contextPlanId || planId;

          if ((!currentUserId || !currentPlanId) && orderId) {
            const transaction = await findTransactionByOrder(orderId, currentUser);
            if (transaction) {
              currentUserId = transaction.user_id;
              currentPlanId = transaction.plan_id;
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
              EnhancedPaymentNavigator.navigateBasedOnPaymentState({
                navigate, userId: currentUserId, planId: currentPlanId, orderId, paymentId: paymentIdArg
              }, {
                isSuccessful: false,
                hasActiveSubscription: false,
                needsAuthentication: false,
                errorMessage: 'Unable to verify payment status'
              });
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

          // Enhanced navigation based on payment status
          if (data.status === PROCESSING_STATES.COMPLETED) {
            setStatus(PROCESSING_STATES.COMPLETED);
            setIsProcessingComplete(true);
            
            EnhancedPaymentNavigator.navigateBasedOnPaymentState({
              navigate,
              userId: currentUserId,
              planId: currentPlanId,
              orderId,
              paymentId: paymentIdOut
            }, {
              isSuccessful: true,
              hasActiveSubscription: true,
              needsAuthentication: !currentUserId || !currentUser
            });
          } else {
            EnhancedPaymentNavigator.navigateBasedOnPaymentState({
              navigate, userId: currentUserId, planId: currentPlanId, orderId, paymentId: paymentIdOut
            }, {
              isSuccessful: false,
              hasActiveSubscription: false,
              needsAuthentication: false,
              errorMessage: `Payment ${data.status.toLowerCase()}`
            });
          }

        } catch (error: any) {
          console.error('Payment verification exception:', error);
          const { hasSubscription, subscription } = await checkDatabaseFirst({ userId: contextUserId || currentUser?.id || userId, planId: contextPlanId || planId, orderId });
          if (hasSubscription) {
            setStatus(PROCESSING_STATES.COMPLETED);
            setFinalPaymentId(subscription?.payment_id || paymentId);
            setIsProcessingComplete(true);
            
            EnhancedPaymentNavigator.navigateBasedOnPaymentState({
              navigate,
              userId: contextUserId || currentUser?.id || userId,
              planId: contextPlanId || planId,
              orderId,
              paymentId: subscription?.payment_id || paymentId
            }, {
              isSuccessful: true,
              hasActiveSubscription: true,
              needsAuthentication: false
            });
            return;
          }

          if (currentPollCount >= 3) {
            setError('Payment verification failed. Please contact support if your payment was successful.');
            EnhancedPaymentNavigator.navigateBasedOnPaymentState({
              navigate, userId: contextUserId, planId: contextPlanId, orderId, paymentId: paymentIdArg
            }, {
              isSuccessful: false,
              hasActiveSubscription: false,
              needsAuthentication: false,
              errorMessage: 'Payment verification failed'
            });
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
    };

    processPayment();

    return () => {
      completeRef.current = false;
      clean();
    };
  }, [success, paymentId, orderId, planId, userId, debugObject, currentUser, isLoadingAuth, hasSessionIndependentData, isProcessingComplete, mapParametersForBackend, navigate]);

  return { status, error, pollCount, MAX_POLLS, finalPaymentId };
}
