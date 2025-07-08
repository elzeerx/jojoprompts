
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
  const [restoredFromBackup, setRestoredFromBackup] = useState(false);
  const MAX_POLLS = 2; // Reduced from 3 to minimize backend calls
  const navigate = useNavigate();

  // Timeout manager
  const { timeoutsRef, addTimeout, clean } = useTimeoutManager();
  const completeRef = useRef(false);
  const verificationAttempted = useRef(false); // Track verification attempts

  // Enhanced session and payment context recovery
  useEffect(() => {
    const initializePaymentFlow = async () => {
      console.log('Initializing payment flow with enhanced session recovery');
      
      // Step 1: Check for existing session first
      try {
        const { data: { user: existingUser } } = await supabase.auth.getUser();
        if (existingUser) {
          console.log('User already authenticated:', existingUser.id);
          setCurrentUser(existingUser);
          setIsLoadingAuth(false);
          return;
        }
      } catch (err) {
        console.log('No existing session found, attempting restoration');
      }

      // Step 2: Attempt session restoration from backup
      const sessionResult = await SessionManager.restoreSession();
      
      if (sessionResult.success && sessionResult.user) {
        setCurrentUser(sessionResult.user);
        setRestoredFromBackup(true);
        console.log('Session restored successfully from backup');
        
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
            console.log('Payment already successful based on restored context, redirecting to success');
            setStatus(PROCESSING_STATES.COMPLETED);
            setIsProcessingComplete(true);
            
            EnhancedPaymentNavigator.navigateBasedOnPaymentState({
              navigate,
              userId: contextUserId || userId,
              planId: contextPlanId || planId,
              orderId: contextOrderId || orderId,
              paymentId
            }, verificationResult);
            setIsLoadingAuth(false);
            return;
          }
        }
      } else {
        console.log('Session restoration failed or no backup found');
      }
      
      setIsLoadingAuth(false);
    };

    initializePaymentFlow();

    // Set up auth state listener for real-time updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      setCurrentUser(session?.user || null);
      
      if (event === 'SIGNED_IN' && session?.user && !isProcessingComplete) {
        console.log('User signed in during payment processing, restarting verification');
        setStatus(PROCESSING_STATES.CHECKING);
        setPollCount(0);
        verificationAttempted.current = false; // Reset verification flag
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

    console.log('Parameter mapping for backend:', {
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
        console.log('Payment verification already attempted, skipping duplicate');
        return;
      }
      verificationAttempted.current = true;

      // Get current user context (could be from restored session or current session)
      const effectiveUserId = currentUser?.id || userId;
      
      console.log('Processing payment with context:', {
        effectiveUserId,
        planId,
        orderId,
        paymentId,
        restoredFromBackup,
        hasSessionIndependentData
      });

      // Phase 1: Database-first verification
      console.log('Starting database-first payment verification');
      const verificationResult = await PaymentStateVerifier.verifyPaymentState(
        effectiveUserId,
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
          console.log('Discount-based payment detected, redirecting to success');
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
        console.error('Missing payment information:', { orderId, paymentId, debugObject });
        
        // Check if we have backup context that might contain the missing info
        const backupContext = SessionManager.getPaymentContext();
        if (backupContext && (backupContext.orderId || backupContext.paymentId)) {
          console.log('Found missing payment info in backup context:', backupContext);
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

        console.log(`Single payment verification attempt:`, verificationParams);

        const { data, error } = await supabase.functions.invoke('verify-paypal-payment', {
          body: verificationParams
        });

        if (error) {
          console.error('Payment verification error:', error);
          throw error;
        }

        console.log('Payment verification response:', data);

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
          console.error('Payment verification failed:', data);
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
          console.log(`Payment still processing, redirecting to success page`);
          const successParams = new URLSearchParams({
            planId: context.planId,
            userId: context.userId,
            paymentId: context.paymentId || '',
            status: 'processing'
          });
          navigate(`/payment-success?${successParams.toString()}`);
        }
      } catch (error: any) {
        console.error('Payment verification attempt failed:', error);
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
    status,
    error,
    pollCount,
    MAX_POLLS,
    finalPaymentId,
    currentUser,
    restoredFromBackup
  };
}
