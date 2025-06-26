
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PaymentSuccessParams } from './usePaymentSuccessParams';
import { usePaymentEmails } from '@/hooks/usePaymentEmails';

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
  const { sendPaymentConfirmation } = usePaymentEmails();
  
  // Use refs to track verification state and prevent duplicate calls
  const verificationAttempted = useRef(false);
  const isVerifying = useRef(false);

  const sendPaymentEmail = useCallback(async (data: any, userName: string, userEmail: string) => {
    console.log('[Email] Attempting to send payment confirmation email');
    
    try {
      const emailResult = await sendPaymentConfirmation(
        userName,
        userEmail,
        data.plan?.name || 'Premium Plan',
        data.transaction?.amount_usd || 0,
        data.transaction?.id || data.paymentId || 'Unknown'
      );

      if (emailResult.success) {
        console.log('[Email] Payment confirmation email sent successfully');
      } else {
        console.error('[Email] Payment confirmation email failed:', emailResult.error);
        // Log failure but don't block the success flow
        toast({
          title: "Email Notice",
          description: "Payment successful, but confirmation email may be delayed.",
          variant: "default",
        });
      }
    } catch (emailError: any) {
      console.error('[Email] Payment confirmation email exception:', emailError);
      // Don't block success flow for email failures
    }
  }, [sendPaymentConfirmation]);

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
      
      // Send payment confirmation email with enhanced error handling
      if (user && user.email) {
        try {
          // Get user profile for name
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();

          const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Valued Customer';
          
          // Send email immediately with proper error handling
          await sendPaymentEmail(data, userName, user.email);
          
        } catch (profileError) {
          console.error('[Email] Error fetching user profile:', profileError);
          // Still attempt to send email with fallback name
          await sendPaymentEmail(data, 'Valued Customer', user.email);
        }
      } else {
        console.warn('[Email] No user email available for payment confirmation');
      }

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
  }, [params.paymentId, params.orderId, params.planId, params.userId, params.debugObject, user, setVerifying, setVerified, setError, sendPaymentEmail]);

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
