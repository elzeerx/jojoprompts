
import { useEffect, useCallback } from "react";
import { PROCESSING_STATES } from "./constants/paymentProcessingConstants";
import { findTransactionByOrder } from "./utils/transactionRecovery";
import { useTimeoutManager } from "./utils/timeoutManager";
import { usePaymentStatusHandler } from "./utils/paymentStatusHandler";
import { UsePaymentProcessingArgs } from "./types/paymentProcessingTypes";
import { SessionManager } from "./helpers/sessionManager";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { safeLog } from "@/utils/safeLogging";
import { usePaymentState } from "./hooks/usePaymentState";
import { usePaymentVerification } from "./hooks/usePaymentVerification";
import { usePaymentNavigation } from "./hooks/usePaymentNavigation";
import { usePaymentErrorRecovery } from "@/hooks/useErrorRecovery";

export function usePaymentProcessing({
  success,
  paymentId,
  orderId,
  planId,
  userId,
  debugObject,
  hasSessionIndependentData,
}: UsePaymentProcessingArgs) {
  const navigate = useNavigate();
  const MAX_POLLS = 2; // Reduced from 3 to minimize backend calls

  // Use the new focused hooks
  const paymentState = usePaymentState();
  const { verifyPaymentState, verifyDiscountPayment, validatePaymentParams } = usePaymentVerification();
  const { navigateToSuccess, navigateToFailed, handleMissingPaymentInfo } = usePaymentNavigation();
  const { retryPayment, isRetrying } = usePaymentErrorRecovery();

  // Timeout manager
  const { timeoutsRef, addTimeout, clean } = useTimeoutManager();

  // Enhanced session and payment context recovery
  useEffect(() => {
    const initializePaymentFlow = async () => {
      safeLog.debug('Initializing payment flow with enhanced session recovery');
      
      // Step 1: Check for existing session first
      try {
        const { data: { user: existingUser } } = await supabase.auth.getUser();
        if (existingUser) {
          safeLog.debug('User already authenticated:', existingUser.id);
          paymentState.setUserContext(existingUser);
          return;
        }
      } catch (err) {
        safeLog.debug('No existing session found, attempting restoration');
      }

      // Step 2: Attempt session restoration from backup
      const sessionResult = await SessionManager.restoreSession();
      
      if (sessionResult.success && sessionResult.user) {
        paymentState.setUserContext(sessionResult.user, true);
        safeLog.debug('Session restored successfully from backup');
        
        // If we have payment context from the restored session, use it
        if (sessionResult.context) {
          const { userId: contextUserId, planId: contextPlanId, orderId: contextOrderId } = sessionResult.context;
          
          // Immediately verify payment state with restored context
          const verificationResult = await verifyPaymentState(
            contextUserId || userId,
            contextPlanId || planId,
            contextOrderId || orderId,
            paymentId
          );

          if (verificationResult.isSuccessful && verificationResult.hasActiveSubscription) {
            safeLog.debug('Payment already successful based on restored context, redirecting to success');
            paymentState.setPaymentSuccess(verificationResult.subscription?.payment_id || paymentId);
            
            navigateToSuccess({
              navigate,
              effectiveUserId: contextUserId || userId,
              planId: contextPlanId || planId,
              orderId: contextOrderId || orderId,
              paymentId,
              subscription: verificationResult.subscription,
              verificationResult
            });
            return;
          }
        }
      } else {
        safeLog.debug('Session restoration failed or no backup found');
      }
      
      paymentState.setIsLoadingAuth(false);
    };

    initializePaymentFlow();

    // Set up auth state listener for real-time updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      safeLog.debug('Auth state changed:', event, session?.user?.id);
      paymentState.setCurrentUser(session?.user || null);
      
      if (event === 'SIGNED_IN' && session?.user && !paymentState.isProcessingComplete) {
        safeLog.debug('User signed in during payment processing, restarting verification');
        paymentState.resetState();
        paymentState.resetVerificationAttempted();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Helper function to map parameters correctly for backend
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

    safeLog.debug('Parameter mapping for backend:', {
      original: params,
      mapped: mappedParams
    });

    return mappedParams;
  }, []);

  // Enhanced payment processing with better error handling and minimal backend calls
  useEffect(() => {
    if (isLoadingAuth || isProcessingComplete || verificationAttempted.current) return;
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
      // Prevent duplicate processing
      if (verificationAttempted.current) {
        safeLog.debug('Payment verification already attempted, skipping duplicate');
        return;
      }
      verificationAttempted.current = true;

      // Get current user context (could be from restored session or current session)
      const effectiveUserId = currentUser?.id || userId;
      
      safeLog.debug('Processing payment with context:', {
        effectiveUserId,
        planId,
        orderId,
        paymentId,
        restoredFromBackup,
        hasSessionIndependentData
      });

      // Phase 1: Database-first verification
      safeLog.debug('Starting database-first payment verification');
      const verificationResult = await PaymentStateVerifier.verifyPaymentState(
        effectiveUserId,
        planId,
        orderId,
        paymentId
      );

      if (verificationResult.isSuccessful && verificationResult.hasActiveSubscription) {
        safeLog.debug('Database verification: Payment successful, subscription active');
        setStatus(PROCESSING_STATES.COMPLETED);
        setFinalPaymentId(verificationResult.subscription?.payment_id || paymentId);
        setIsProcessingComplete(true);
        
        EnhancedPaymentNavigator.navigateBasedOnPaymentState({
          navigate,
          userId: effectiveUserId,
          planId,
          orderId,
          paymentId: verificationResult.subscription?.payment_id || paymentId
        }, verificationResult);
        return;
      }

      // Phase 2: Check for discount-based payment
      const { hasSubscription, subscription } = await checkDatabaseFirst({ 
        userId: effectiveUserId, 
        planId, 
        orderId 
      });
      
      if (hasSubscription && subscription) {
        const isDiscountPayment = subscription.payment_method === 'discount_100_percent' || 
                                 (subscription.payment_id && subscription.payment_id.startsWith('discount_'));
        
        if (isDiscountPayment) {
          safeLog.debug('Discount-based payment detected, redirecting to success');
          setStatus(PROCESSING_STATES.COMPLETED);
          setFinalPaymentId(subscription.payment_id);
          setIsProcessingComplete(true);
          
          EnhancedPaymentNavigator.navigateBasedOnPaymentState({
            navigate,
            userId: effectiveUserId,
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

      // Phase 3: Handle missing payment information
      if (!orderId && !paymentId) {
        safeLog.error('Missing payment information:', { orderId, paymentId, debugObject });
        
        // Check if we have backup context that might contain the missing info
        const backupContext = SessionManager.getPaymentContext();
        if (backupContext && (backupContext.orderId || backupContext.paymentId)) {
          safeLog.debug('Found missing payment info in backup context:', backupContext);
          // Retry with backup context data
          await processPaymentWithContext(backupContext);
          return;
        }
        
        setError('Missing payment information in callback URL');
        
        EnhancedPaymentNavigator.navigateBasedOnPaymentState({
          navigate, 
          userId: effectiveUserId, 
          planId, 
          orderId, 
          paymentId
        }, {
          isSuccessful: false,
          hasActiveSubscription: false,
          needsAuthentication: !currentUser,
          errorMessage: 'Missing payment information'
        });
        return;
      }

      // Phase 4: Single backend verification call (no polling)
      await processPaymentWithContext({
        userId: effectiveUserId,
        planId,
        orderId,
        paymentId
      });
    };

    const processPaymentWithContext = async (context: any) => {
      try {
        setStatus(PROCESSING_STATES.VERIFYING);
        setPollCount(1); // Single attempt

        // Prepare parameters with proper mapping
        const verificationParams = mapParametersForBackend({
          orderId: context.orderId || '',
          paymentId: context.paymentId || '',
          userId: context.userId || '',
          planId: context.planId || ''
        });

        safeLog.debug(`Single payment verification attempt:`, verificationParams);

        const { data, error } = await supabase.functions.invoke('verify-paypal-payment', {
          body: verificationParams
        });

        if (error) {
          safeLog.error('Payment verification error:', error);
          throw error;
        }

        safeLog.debug('Payment verification response:', data);

        if (data?.success && data?.status === 'COMPLETED') {
          setStatus(PROCESSING_STATES.COMPLETED);
          setFinalPaymentId(data.paymentId);
          setIsProcessingComplete(true);

          const successParams = new URLSearchParams({
            planId: context.planId,
            userId: context.userId,
            paymentId: data.paymentId,
            status: 'completed',
            source: 'payment_processing' // Add source flag to prevent dual verification
          });

          navigate(`/payment-success?${successParams.toString()}`);
          return;
        } else if (data?.status === 'ERROR' || data?.error) {
          safeLog.error('Payment verification failed:', data);
          setError(data?.error || 'Payment verification failed');
          
          // Enhanced error handling - check if payment was successful but user needs to log in
          if (data?.errorTips?.some((tip: string) => tip.toLowerCase().includes('login'))) {
            const params = new URLSearchParams();
            params.append('auth_required', 'true');
            if (planId) params.append('planId', planId);
            params.append('reason', 'Payment successful but authentication required');
            navigate(`/payment-success?${params.toString()}`);
            return;
          }
          
          const params = new URLSearchParams();
          if (planId) params.append('planId', planId);
          params.append('reason', data?.error || 'Payment verification failed');
          navigate(`/payment-failed?${params.toString()}`);
          return;
        } else {
          // Payment still processing - redirect to success with processing status
          safeLog.debug(`Payment still processing, redirecting to success page`);
          const successParams = new URLSearchParams({
            planId: context.planId,
            userId: context.userId,
            paymentId: context.paymentId || '',
            status: 'processing'
          });
          navigate(`/payment-success?${successParams.toString()}`);
        }
      } catch (error: any) {
        safeLog.error('Payment verification attempt failed:', error);
        setError(error.message || 'Payment verification failed');
        
        const params = new URLSearchParams();
        if (planId) params.append('planId', planId);
        params.append('reason', error.message || 'Payment verification failed');
        navigate(`/payment-failed?${params.toString()}`);
      }
    };

    processPayment();

    return () => {
      clean();
    };
  }, [currentUser, isLoadingAuth, isProcessingComplete, success, orderId, paymentId, planId, userId, mapParametersForBackend, navigate, addTimeout, clean]);

  const handleStatusUpdate = usePaymentStatusHandler({
    setStatus,
    setError,
    navigate,
    planId,
    userId: currentUser?.id || userId,
    paymentId: finalPaymentId
  });

  return {
    status: paymentState.status,
    error: paymentState.error,
    pollCount: paymentState.pollCount,
    MAX_POLLS,
    finalPaymentId: paymentState.finalPaymentId,
    currentUser: paymentState.currentUser,
    restoredFromBackup: paymentState.restoredFromBackup
  };
}
