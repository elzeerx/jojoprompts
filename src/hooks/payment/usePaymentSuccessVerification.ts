
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to handle post-payment success verification flow for PayPal payments.
 * 1. First verifies/captures the PayPal payment via edge function (verify-paypal-payment)
 * 2. Then calls the subscriptions edge function (create-subscription) with PayPal details
 * 3. Handles errors accordingly and updates verification state
 */
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
    const verifyPaypalPayment = async () => {
      try {
        const { planId, userId, token, payerId } = params;

        if (!planId || !userId || !token) {
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

        // Step 1: Verify and capture the PayPal order
        const { data: verify, error: verifyError } = await supabase.functions.invoke("verify-paypal-payment", {
          headers: {
            "Content-Type": "application/json"
          },
          query: {
            order_id: token // PayPal order_id is the "token" param
          }
        });

        if (verifyError || !verify || !(verify.status === "COMPLETED")) {
          setError('Unable to verify payment completion.');
          toast({
            title: "Payment Verification Error",
            description: verifyError?.message || "Your PayPal payment could not be verified. Please contact support.",
            variant: "destructive",
          });
          setTimeout(() => {
            const reason = 'PayPal payment could not be verified - please contact support';
            navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent(reason)}`);
          }, 3000);
          return;
        }

        // Step 2: Now call create-subscription (passing new-style PayPal info)
        const paypal_payment_id =
          verify.paymentId ||
          verify.paypal?.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
          verify.paypal?.id ||
          undefined;

        if (!paypal_payment_id) {
          setError('Unable to determine PayPal payment ID.');
          toast({
            title: "Payment Error",
            description: "We could not confirm your PayPal payment. Please contact support.",
            variant: "destructive",
          });
          setTimeout(() => {
            const reason = 'Could not confirm PayPal payment - missing payment ID';
            navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent(reason)}`);
          }, 3000);
          return;
        }

        const { data: create, error: createError } = await supabase.functions.invoke("create-subscription", {
          body: {
            planId,
            userId,
            paypal_payment_id
          }
        });

        if (createError || !create || !create.success) {
          setError('Subscription activation failed');
          toast({
            title: "Subscription Error",
            description: "Your payment was successful, but we were unable to activate your subscription. Please contact support.",
            variant: "destructive",
          });
          setTimeout(() => {
            const reason = 'Subscription activation failed after successful payment';
            navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          }, 3000);
          return;
        }

        setVerified(true);
        setVerifying(false);

        toast({
          title: "Payment Successful!",
          description: "Your subscription has been activated successfully.",
        });

      } catch (error: any) {
        setError('Payment verification failed');
        setTimeout(() => {
          const planId = params.planId;
          const reason = 'Payment verification failed - system error';
          navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent(reason)}`);
        }, 3000);
      }
    };

    verifyPaypalPayment();
    // eslint-disable-next-line
  }, [user, navigate, params]);
}

