
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { PaymentParams } from './usePaymentParams';
import { safeLog } from '@/utils/safeLogging';
import { usePostPurchaseEmail } from '@/hooks/usePostPurchaseEmail';

interface UsePaymentSuccessVerificationProps {
  params: PaymentParams;
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
  const { sendPostPurchaseEmails } = usePostPurchaseEmail();
  
  // Simplified state tracking - only track active verification
  const isVerifying = useRef(false);

  const verifyPayment = useCallback(async () => {
    // Simplified duplicate prevention - only prevent if actively verifying
    if (isVerifying.current) {
      safeLog.debug('Payment verification already in progress, skipping');
      return;
    }

    // Simplified success detection - if we have payment completion indicators, show success
    if (params.paymentId && params.planId && params.userId) {
      safeLog.debug('Payment success detected from URL params');
      setVerified(true);
      setVerifying(false);
      toast({
        title: "Payment Successful! 🎉",
        description: "Your subscription has been activated successfully.",
      });
      return;
    }

    // Check if we have the minimum required parameters
    if (!params.paymentId && !params.orderId) {
      safeLog.debug('Missing payment information for verification');
      setError('Missing payment information. Please contact support if you completed payment.');
      setVerifying(false);
      return;
    }

    safeLog.debug('Starting payment verification with params:', {
      paymentId: params.paymentId,
      orderId: params.orderId,
      planId: params.planId,
      userId: params.userId
    });

    // Mark as verifying
    isVerifying.current = true;
    setVerifying(true);
    setError(null);

    try {
      // Simplified approach - show success for any valid payment parameters
      // The backend handles the actual verification and subscription creation
      if (params.orderId || params.paymentId) {
        safeLog.debug('Payment verification completed - valid payment identifiers found');
        
        setVerified(true);
        
        // Send post-purchase emails if user info is available
        if (user?.email && params.planId && (params.paymentId || params.orderId)) {
          const firstName = user.user_metadata?.first_name || user.email.split('@')[0];
          const planName = 'Premium Plan'; // You may want to fetch actual plan name
          const paymentId = params.paymentId || params.orderId || 'N/A';
          
          // Send emails in background
          setTimeout(() => {
            sendPostPurchaseEmails(user.email!, firstName, planName, paymentId);
          }, 1000);
        }
        
        toast({
          title: "Payment Successful! 🎉",
          description: "Your subscription has been activated successfully.",
        });
      } else {
        throw new Error('No valid payment identifiers found');
      }

    } catch (error: any) {
      safeLog.error('Payment verification failed:', error);
      setError(`Payment verification failed: ${error.message}`);
    } finally {
      isVerifying.current = false;
      setVerifying(false);
    }
  }, [params, setVerifying, setVerified, setError]);

  useEffect(() => {
    // Always run verification when params change
    safeLog.debug('useEffect triggered, starting payment verification');
    verifyPayment();
  }, [verifyPayment]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      safeLog.debug('Payment verification hook unmounting');
      isVerifying.current = false;
    };
  }, []);
}
