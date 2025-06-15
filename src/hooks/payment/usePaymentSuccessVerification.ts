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
    function gotoFailedPage(planId: string | null | undefined, reason: string, delayMs: number = 2000) {
      setTimeout(() => {
        navigate(`/payment-failed?planId=${planId || ''}&reason=${encodeURIComponent(reason)}`);
      }, delayMs);
    }

    // Better: fallback to DB check if no session user
    const verifyAndActivate = async () => {
      setVerifying(true);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      let activeUser = user;
      if (sessionData.session?.user) {
        activeUser = sessionData.session.user;
      }

      // Removed "paymentId" from destructuring, since it's not in params.
      const { planId, userId, token, payerId } = params;

      // 1. Core payment details required (removed paymentId from logic)
      if (!planId || !userId || !token) {
        setError('Missing payment information');
        setVerifying(false);
        gotoFailedPage(planId, 'Missing payment information - please try again', 1500);
        return;
      }

      // 2. Try normal session flow; fallback to DB state if no session
      if (!activeUser) {
        // Fallback: check DB for a completed subscription for userId and planId
        try {
          // DB fallback: is there an active subscription for this plan & user?
          const { data: sub, error: subError } = await supabase
            .from("user_subscriptions")
            .select("id,status,plan_id,user_id,created_at")
            .eq("user_id", userId)
            .eq("plan_id", planId)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .maybeSingle();

          if (sub && sub.status === "active") {
            // Show payment as successful
            setVerified(true);
            setVerifying(false);
            toast({
              title: "Payment Successful!",
              description: "Your subscription is now active. You may need to login, but your payment has been captured.",
            });
            setTimeout(() => navigate("/prompts"), 1800);
            return;
          }

          setError('You must be logged in to complete your payment. Please sign in and try again.');
          setVerifying(false);
          toast({
            title: "Authentication Error",
            description: "Your login could not be restored, but your payment may have succeeded. Please log in.",
            variant: "destructive",
          });
          gotoFailedPage(planId, "No authentication session");
          return;
        } catch (e) {
          setError('Payment session timeout or invalid. Please try again.');
          setVerifying(false);
          gotoFailedPage(planId, "No authentication session");
          return;
        }
      }

      // 3. User session must match userId in params
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
        // --- Step 1: Verify/capture order with PayPal via edge function ---
        const { data: verify, error: verifyError } = await supabase.functions.invoke("verify-paypal-payment", {
          headers: {
            "Content-Type": "application/json",
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
          },
          body: {
            order_id: token, // token is order_id from PayPal return
            payer_id: payerId,
          }
        });

        if (verifyError?.status === 401 || verifyError?.message?.toLowerCase().includes("authorization")) {
          setError('Authentication expired. Please log in again to complete your payment.');
          setVerifying(false);
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
          setVerifying(false);
          toast({
            title: "Payment Verification Error",
            description: verifyError?.message || "Your PayPal payment could not be verified. Please contact support.",
            variant: "destructive",
          });
          gotoFailedPage(planId, 'PayPal payment could not be verified - please contact support');
          return;
        }

        // --- Step 2: Extract PayPal paymentId robustly ---
        const paypal_payment_id =
          verify.paymentId ||
          verify.paypal?.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
          verify.paypal?.id ||
          verify?.paypal_payment_id ||
          undefined;

        if (!paypal_payment_id) {
          setError('Unable to determine PayPal payment ID.');
          setVerifying(false);
          toast({
            title: "Payment Error",
            description: "We could not confirm your PayPal payment. Please contact support.",
            variant: "destructive",
          });
          gotoFailedPage(planId, 'Could not confirm PayPal payment - missing payment ID');
          return;
        }

        // --- Step 3: Create subscription ---
        const { data: create, error: createError } = await supabase.functions.invoke("create-subscription", {
          headers: {
            "Content-Type": "application/json",
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
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
          setVerifying(false);
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
        setVerifying(false);
        toast({
          title: "Payment Verification Error",
          description: "There was a system error during payment verification.",
          variant: "destructive",
        });
        gotoFailedPage(params.planId, 'Payment verification failed - system error');
      }
    };

    verifyAndActivate();
    // eslint-disable-next-line
  }, [user, navigate, params]);
}
