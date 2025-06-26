
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PaymentSuccessParams } from './usePaymentSuccessParams';

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
      console.log('Payment verification already attempted or in progress, skipping');
      return;
    }

    // Check if we have the minimum required parameters
    if (!params.paymentId && !params.orderId) {
      console.log('Missing payment information, setting error');
      setError('Missing payment information');
      setVerifying(false);
      return;
    }

    console.log('Starting payment verification with params:', {
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
      // Verify the payment with the backend
      const { data, error } = await supabase.functions.invoke('verify-paypal-payment', {
        body: {
          paymentId: params.paymentId,
          orderId: params.orderId,
          planId: params.planId,
          userId: params.userId,
          debugObject: params.debugObject
        }
      });

      console.log('[VERIFICATION] Backend response:', { data, error });

      if (error) {
        console.error('Payment verification error:', error);
        setError(`Payment verification failed: ${error.message}`);
        return;
      }

      if (!data?.success) {
        console.error('Payment verification failed:', data);
        setError(data?.error || 'Payment verification failed');
        return;
      }

      // Payment verified successfully
      console.log('Payment verified successfully:', data);
      
      // Note: Email sending is now handled by the backend verify-paypal-payment function
      // No need to send emails from the frontend anymore
      
      setVerified(true);
      toast({
        title: "Payment Successful! 🎉",
        description: "Your subscription has been activated successfully.",
      });

    } catch (error: any) {
      console.error('Payment verification exception:', error);
      setError(`Payment verification failed: ${error.message}`);
    } finally {
      isVerifying.current = false;
      setVerifying(false);
    }
  }, [params.paymentId, params.orderId, params.planId, params.userId, params.debugObject, user, setVerifying, setVerified, setError]);

  useEffect(() => {
    // Only run verification if we haven't attempted it yet
    if (!verificationAttempted.current) {
      console.log('useEffect triggered, starting payment verification');
      verifyPayment();
    }
  }, [verifyPayment]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Payment verification hook unmounting');
      isVerifying.current = false;
    };
  }, []);
}
