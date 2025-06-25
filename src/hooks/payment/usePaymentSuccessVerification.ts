
import { useEffect } from 'react';
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

  useEffect(() => {
    const verifyPayment = async () => {
      if (!params.paymentId && !params.orderId) {
        setError('Missing payment information');
        setVerifying(false);
        return;
      }

      try {
        setVerifying(true);

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
          setVerifying(false);
          return;
        }

        if (!data?.success) {
          console.error('Payment verification failed:', data);
          setError(data?.error || 'Payment verification failed');
          setVerifying(false);
          return;
        }

        // Payment verified successfully
        console.log('Payment verified successfully:', data);
        
        // Send payment confirmation email
        if (user && data.transaction && data.plan) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();

          if (profile && user.email) {
            const userName = `${profile.first_name} ${profile.last_name}`.trim();
            setTimeout(async () => {
              await sendPaymentConfirmation(
                userName,
                user.email!,
                data.plan.name,
                data.transaction.amount_usd,
                data.transaction.id
              );
            }, 1000);
          }
        }

        setVerified(true);
        setVerifying(false);

        toast({
          title: "Payment Successful! 🎉",
          description: "Your subscription has been activated successfully.",
        });

      } catch (error: any) {
        console.error('Payment verification exception:', error);
        setError(`Payment verification failed: ${error.message}`);
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [params, user, navigate, setVerifying, setVerified, setError, sendPaymentConfirmation]);
}
