import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedPaymentNavigator } from '../helpers/enhancedPaymentNavigator';
import { SessionManager } from '../helpers/sessionManager';
import { safeLog } from '@/utils/safeLogging';
import { buildPaymentSuccessUrl, buildPaymentFailedUrl } from '@/utils/paymentUtils';

interface PaymentNavigationParams {
  navigate: ReturnType<typeof useNavigate>;
  effectiveUserId: string;
  planId: string;
  orderId: string;
  paymentId: string;
  subscription?: any;
  verificationResult?: any;
}

export function usePaymentNavigation() {
  const navigate = useNavigate();

  const navigateToSuccess = useCallback((params: PaymentNavigationParams) => {
    const { effectiveUserId, planId, orderId, paymentId, subscription, verificationResult } = params;
    
    const finalPaymentId = subscription?.payment_id || paymentId;
    
    safeLog.debug('Navigating to payment success', {
      userId: effectiveUserId,
      planId,
      orderId,
      paymentId: finalPaymentId
    });

    EnhancedPaymentNavigator.navigateBasedOnPaymentState({
      navigate,
      userId: effectiveUserId,
      planId,
      orderId,
      paymentId: finalPaymentId
    }, verificationResult);
  }, [navigate]);

  const navigateToFailed = useCallback((
    effectiveUserId: string,
    planId: string,
    orderId: string,
    reason: string
  ) => {
    safeLog.debug('Navigating to payment failed', { reason });
    
    EnhancedPaymentNavigator.navigateBasedOnPaymentState({
      navigate, 
      userId: effectiveUserId, 
      planId, 
      orderId, 
      paymentId: ''
    }, {
      isSuccessful: false,
      hasActiveSubscription: false,
      needsAuthentication: false,
      errorMessage: reason
    });
  }, [navigate]);

  const handleMissingPaymentInfo = useCallback(async (
    orderId: string | undefined,
    paymentId: string | undefined,
    effectiveUserId: string,
    planId: string,
    processPaymentWithContext: (context: any) => Promise<void>
  ): Promise<boolean> => {
    if (!orderId && !paymentId) {
      safeLog.error('Missing payment information:', { orderId, paymentId });
      
      // Check if we have backup context that might contain the missing info
      const backupContext = SessionManager.getPaymentContext();
      if (backupContext && (backupContext.orderId || backupContext.paymentId)) {
        safeLog.debug('Found missing payment info in backup context:', backupContext);
        // Retry with backup context data
        await processPaymentWithContext(backupContext);
        return true; // Handled by backup context
      }
      
      navigateToFailed(effectiveUserId, planId, orderId || '', 'Missing payment information in callback URL');
      return true; // Handled by navigation
    }
    
    return false; // Not handled, continue with normal flow
  }, [navigateToFailed]);

  return {
    navigateToSuccess,
    navigateToFailed,
    handleMissingPaymentInfo
  };
} 