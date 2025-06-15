
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Payment verification and redirection flow.
 * - Handles PayPal callback, verifies/captures payment, creates subscription, redirects to /prompts on success.
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
    /**
     * Helper: redirects to failure page with optional reason after short delay
     */
    function gotoFailedPage(planId: string | null | undefined, reason: string, delayMs: number = 2000) {
      setTimeout(() => {
        navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent(reason)}`);
      }, delayMs);
    }

    // New logic: Always refresh session and handle authentication loss after PayPal return.
    const refreshSessionAndVerify = async () => {
      setVerifying(true);

      // Always refresh session
      const { data: sessionData } = await supabase.auth.getSession();
      let activeUser = user;
      if (sessionData.session?.user) {
        activeUser = sessionData.session.user;
      }

      const { planId, userId, token, payerId } = params;

      // 1. User must exist
      if (!activeUser) {
        setError('You must be logged in to complete your payment. Please sign in and try again.');
        setVerifying(false);
        toast({
          title: "Authentication Error",
          description: "Your login session could not be restored. Please log in again to complete your payment.",
          variant: "destructive",
        });
        gotoFailedPage(planId, "No authentication session");
        return;
      }

      // 2. Basic payment information must be present
      if (!planId || !userId || !token) {
        setError('Missing payment information');
        gotoFailedPage(planId, 'Missing payment information - please try again', 1500);
        return;
      }

      // 3. User session must match payment userId
      if (userId !== activeUser.id) {
        setError('Payment session does not match your account. Please sign in with the account you used for checkout.');
        setVerifying(false);
        toast({
          title: "User Authentication Mismatch",
          description: "The payment was made with a different account. Please log in with the correct email and try again.",
          variant: "destructive",
        });
        gotoFailedPage(planId, 'Invalid payment session - user mismatch', 1500);
        return;
      }

      try {
        // Step 1: Verify and capture the PayPal order
        const { data: verify, error: verifyError } = await supabase.functions.invoke("verify-paypal-payment", {
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            order_id: token,
            payer_id: payerId,
          }
        });

        // Special error handling for 401/missing authorization/expired
        if (verifyError?.status === 401 || verifyError?.message?.toLowerCase().includes("authorization")) {
          setError('Authentication expired. Please log in again to complete your payment.');
          toast({
            title: "Session Expired",
            description: "Please log in again to verify your payment.",
            variant: "destructive",
          });
          gotoFailedPage(planId, 'Authentication expired', 1000);
          return;
        }

        if (verifyError || !verify || !(verify.status === "COMPLETED")) {
          setError('Unable to verify payment completion.');
          toast({
            title: "Payment Verification Error",
            description: verifyError?.message || "Your PayPal payment could not be verified. Please contact support.",
            variant: "destructive",
          });
          gotoFailedPage(planId, 'PayPal payment could not be verified - please contact support');
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
          gotoFailedPage(planId, 'Could not confirm PayPal payment - missing payment ID');
          return;
        }

        // Continue: create subscription
        const { data: create, error: createError } = await supabase.functions.invoke("create-subscription", {
          headers: {
            "Content-Type": "application/json",
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
          gotoFailedPage(planId, 'Subscription activation failed after successful payment');
          return;
        }

        setVerified(true);
        setVerifying(false);

        toast({
          title: "Payment Successful!",
          description: "Your subscription has been activated successfully. Redirecting to Prompts.",
        });

        setTimeout(() => {
          navigate("/prompts");
        }, 1800);

      } catch (error: any) {
        setError('Payment verification failed');
        toast({
          title: "Payment Verification Error",
          description: "There was a system error during payment verification.",
          variant: "destructive",
        });
        gotoFailedPage(params.planId, 'Payment verification failed - system error');
      }
    };

    refreshSessionAndVerify();
    // eslint-disable-next-line
  }, [user, navigate, params]);
}

