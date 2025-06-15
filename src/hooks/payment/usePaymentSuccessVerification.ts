
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface PaymentSuccessVerificationConfig {
  params: ReturnType<typeof import('./usePaymentSuccessParams').usePaymentSuccessParams>;
  setVerifying: (b: boolean) => void;
  setVerified: (b: boolean) => void;
  setError: (s: string | null) => void;
}

export function usePaymentSuccessVerification({
  params,
  setVerifying,
  setVerified,
  setError,
}: PaymentSuccessVerificationConfig) {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const { planId, userId, tapId, chargeStatus, responseCode, chargeId, paymentResult, allParams, paymentMethod } = params;

        // Failure detection logic
        const explicitFailures = [
          'DECLINED', 'FAILED', 'CANCELLED', 'ABANDONED', 'EXPIRED',
          'REJECTED', 'VOIDED', 'ERROR', 'TIMEOUT', 'UNAUTHORIZED'
        ];
        const failureResponseCodes = [
          '101', '102', '103', '104', '105', '106', '107', '108', '109', '110',
          '201', '202', '203', '204', '205', '206', '207', '208', '209', '210',
          '301', '302', '303', '304', '305', '306', '307', '308', '309', '310'
        ];
        const isExplicitFailure =
          (chargeStatus && explicitFailures.includes(chargeStatus.toUpperCase())) ||
          (responseCode && failureResponseCodes.includes(responseCode)) ||
          paymentResult === 'failed' || paymentResult === 'error';

        if (isExplicitFailure) {
          const reason = chargeStatus ? `Payment ${chargeStatus.toLowerCase()}` :
            responseCode ? `Payment declined (Code: ${responseCode})` :
            'Payment was not completed successfully';
          navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          return;
        }

        if (!planId || !userId) {
          setError('Missing payment information');
          setTimeout(() => {
            const reason = 'Missing payment information - please try again';
            navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent(reason)}`);
          }, 3000);
          return;
        }

        if (user && userId !== user.id) {
          setError('Invalid payment session');
          setTimeout(() => {
            const reason = 'Invalid payment session - please log in and try again';
            navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          }, 3000);
          return;
        }

        const pendingPaymentStr = localStorage.getItem('pending_payment');
        const pendingPayment = pendingPaymentStr ? JSON.parse(pendingPaymentStr) : null;

        const paymentData = {
          paymentId: tapId || chargeId || pendingPayment?.paymentId || `tap_${Date.now()}`,
          paymentMethod: 'tap',
          details: {
            id: tapId || chargeId || pendingPayment?.paymentId,
            status: chargeStatus || 'completed',
            amount: pendingPayment?.amount,
            currency: pendingPayment?.currency || 'USD',
            response_code: responseCode,
            payment_result: paymentResult,
            reference: pendingPayment?.reference
          }
        };

        const { data, error } = await supabase.functions.invoke("create-subscription", {
          body: {
            planId,
            userId,
            paymentData
          }
        });

        if (error) {
          setError('Subscription setup failed');
          toast({
            title: "Subscription Error",
            description: "Payment was successful but subscription setup failed. Please contact support.",
            variant: "destructive",
          });
          setTimeout(() => {
            const reason = 'Subscription setup failed - payment confirmed but access not granted';
            navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          }, 3000);
          return;
        }

        if (!data || !data.success) {
          setError('Subscription activation failed');
          setTimeout(() => {
            const reason = 'Subscription activation failed - please contact support';
            navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          }, 3000);
          return;
        }

        localStorage.removeItem('pending_payment');
        setVerified(true);
        setVerifying(false);

        toast({
          title: "Payment Successful!",
          description: "Your subscription has been activated successfully.",
        });

      } catch (error) {
        setError('Payment verification failed');
        setTimeout(() => {
          const planId = params.planId;
          const reason = 'Payment verification failed - system error';
          navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent(reason)}`);
        }, 3000);
      }
    };

    verifyPayment();
    // eslint-disable-next-line
  }, [user, navigate, params]);
}
