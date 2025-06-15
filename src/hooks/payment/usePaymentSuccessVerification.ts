
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
    // Start by trying a session refresh, since a SPA may have an old/null session after PayPal redirect
    const refreshSessionAndVerify = async () => {
      setVerifying(true);

      // Always attempt to refresh session before verifying payment
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      let activeUser = user;
      if (sessionData.session?.user) {
        activeUser = sessionData.session.user;
      }

      // 1. Session must exist
      if (!activeUser) {
        setError('You must be logged in to complete your payment. Please sign in and try again.');
        setVerifying(false);
        toast({
          title: "Authentication Error",
          description: "Your login session could not be restored. Please log in again to complete your payment.",
          variant: "destructive",
        });
        setTimeout(() => {
          navigate("/login"); // Could redirect to a custom "login and finish payment" page if desired
        }, 3000);
        return;
      }

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

        // 2. User in session must match the payment userId (security)
        if (userId !== activeUser.id) {
          setError('Payment session does not match your account. Please sign in with the account you used for checkout.');
          setVerifying(false);
          toast({
            title: "User Authentication Mismatch",
            description: "The payment was made with a different account. Please log in with the correct email and try again.",
            variant: "destructive",
          });
          setTimeout(() => {
            const reason = 'Invalid payment session - user mismatch';
            navigate(`/payment-failed?planId=${planId}&reason=${encodeURIComponent(reason)}`);
          }, 3000);
          return;
        }

        // Step 1: Verify and capture the PayPal order
        const { data: verify, error: verifyError } = await supabase.functions.invoke("verify-paypal-payment", {
          headers: {
            "Content-Type": "application/json",
            // Optionally, send the JWT if needed for edge authentication (currently not required on this function)
          },
          body: {
            order_id: token,
            payer_id: payerId,
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

        // Step 3: Pass the active user's access_token (JWT) to create-subscription for future-proofing
        const { data: create, error: createError } = await supabase.functions.invoke("create-subscription", {
          headers: {
            "Content-Type": "application/json",
            // Optionally, add Authorization: Bearer <token> header if needed on backend
          },
          body: {
            planId,
            userId,
            paymentData: {
              paymentMethod: "paypal",
              paymentId: paypal_payment_id,
              details: verify.paypal
            }
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

    refreshSessionAndVerify();
    // eslint-disable-next-line
  }, [user, navigate, params]);
}

