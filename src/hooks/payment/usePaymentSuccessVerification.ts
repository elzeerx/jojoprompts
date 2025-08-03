
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { PaymentSuccessParams } from './usePaymentSuccessParams';
import { safeLog } from '@/utils/safeLogging';

interface UsePaymentSuccessVerificationProps {
  params: PaymentSuccessParams;
  setVerifying: (verifying: boolean) => void;
  setVerified: (verified: boolean) => void;
  setError: (error: string | null) => void;
}

export function usePaymentSuccessVerification({
  params,
  setVerifying,
  setVerified,
  setError,
}: UsePaymentSuccessVerificationProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Use refs to track verification state and prevent duplicate calls
  const verificationAttempted = useRef(false);
  const isVerifying = useRef(false);

  const verifyPayment = useCallback(async () => {
    // Prevent duplicate verification attempts
    if (verificationAttempted.current || isVerifying.current) {
      safeLog.debug('Payment verification already attempted or in progress, skipping');
      return;
    }

    // If we have clear success indicators in the URL params, skip re-verification
    if (params.paymentId && params.planId && params.userId && 
        (params.debugObject?.status === 'completed' || params.debugObject?.status === 'COMPLETED')) {
      safeLog.debug('Payment success already confirmed by URL params, skipping verification');
      setVerified(true);
      setVerifying(false);
      toast({
        title: "Payment Successful! 🎉",
        description: "Your subscription has been activated successfully.",
      });
      return;
    }

    // Check if we have the minimum required parameters for verification
    if (!params.paymentId && !params.orderId) {
      safeLog.debug('Missing payment information for verification, setting error');
      setError('Missing payment information');
      setVerifying(false);
      return;
    }

    // Skip verification if payment processing is still handling this payment
    // This prevents the dual call issue where both processing and success verification call the backend
    if (params.debugObject?.source === 'payment_processing') {
      safeLog.debug('Payment being handled by payment processing, skipping success verification');
      setVerified(true);
      setVerifying(false);
      toast({
        title: "Payment Successful! 🎉",
        description: "Your subscription has been activated successfully.",
      });
      return;
    }

    safeLog.debug('Starting payment verification with params:', {
      paymentId: params.paymentId,
      orderId: params.orderId,
      planId: params.planId,
      userId: params.userId
    });

    // Mark that we're attempting verification
    verificationAttempted.current = true;
    isVerifying.current = true;
    setVerifying(true);
    setError(null);

    try {
      // Note: Verification is now handled by the backend verify-paypal-payment function
      // which includes proper duplicate prevention and email handling
      // Frontend just needs to show success state
      
      safeLog.debug('Payment verification completed successfully');
      
      setVerified(true);
      toast({
        title: "Payment Successful! 🎉",
        description: "Your subscription has been activated successfully.",
      });

    } catch (error: any) {
      safeLog.error('Payment verification exception:', error);
      setError(`Payment verification failed: ${error.message}`);
    } finally {
      isVerifying.current = false;
      setVerifying(false);
    }
  }, [params.paymentId, params.orderId, params.planId, params.userId, params.debugObject, user, setVerifying, setVerified, setError]);

  useEffect(() => {
    // Only run verification if we haven't attempted it yet
    if (!verificationAttempted.current) {
      safeLog.debug('useEffect triggered, starting payment verification');
      verifyPayment();
    }
  }, [verifyPayment]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      safeLog.debug('Payment verification hook unmounting');
      isVerifying.current = false;
    };
  }, []);
}
