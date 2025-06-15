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
    function gotoFailedPage(planId: string | null | undefined, reason: string, delayMs: number = 2000, userId?: string) {
      setTimeout(() => {
        // Add both planId and userId to failed page (for checkout recovery)
        let url = `/payment-failed?reason=${encodeURIComponent(reason)}`;
        if (planId) url += `&planId=${planId}`;
        if (userId) url += `&userId=${userId}`;
        navigate(url);
      }, delayMs);
    }

    // Normalize parameter extraction (support planId/plan_id and userId/user_id)
    const extractParam = (key: string) => params[key] || params[key.toLowerCase()] || params[key.replace("_", "")] || params[key.replace(/[A-Z]/g, m => "_" + m.toLowerCase())];
    const planId = extractParam("planId") || extractParam("plan_id");
    const userId = extractParam("userId") || extractParam("user_id");
    const token = params.token;
    const payerId = params.payerId;

    // Debug
    console.log("PaymentSuccessVerification params normalized:", { planId, userId, token, payerId, allParams: params.allParams });

    setVerifying(true);

    const verifyAndActivate = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      let activeUser = user;
      if (sessionData.session?.user) {
        activeUser = sessionData.session.user;
      }

      // Core payment details required
      if (!planId || !userId || !token) {
        setError('Missing payment information');
        setVerifying(false);
        gotoFailedPage(planId, 'Missing payment information - please try again', 1500, userId);
        return;
      }

      // Database fallback: No active session/user
      if (!activeUser) {
        try {
          // DB fallback: is there an active subscription for this plan & user?
          const { data: sub } = await supabase
            .from("user_subscriptions")
            .select("id,status,plan_id,user_id,created_at")
            .eq("user_id", userId)
            .eq("plan_id", planId)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .maybeSingle();

          if (sub && sub.status === "active") {
            setVerified(true);
            setVerifying(false);
            toast({
              title: "Payment Successful!",
              description: "Your subscription is now active. Please log in to access your content.",
            });
            // Instead of redirect, prompt login
            setTimeout(() => {
              setError("Payment complete. Please log in to unlock your plan."); // Triggers login options on UI
            }, 1500);
            return;
          }

          // No subscription: prompt login recovery with guidance
          setError(
            'You must be logged in to complete your payment. If you already paid, please log back in to unlock access.'
          );
          setVerifying(false);
          toast({
            title: "Authentication Required",
            description: "Please log in to unlock your access. Your payment was likely successful!",
            variant: "destructive",
          });
          gotoFailedPage(planId, "No authentication session", 2000, userId);
          return;
        } catch (e) {
          setError('Payment session timeout or invalid. Please try again.');
          setVerifying(false);
          gotoFailedPage(planId, "No authentication session", 2000, userId);
          return;
        }
      }

      // Session mismatch (user id mismatch)
      if (userId !== activeUser.id) {
        setError('Payment session does not match your account. Please sign in with the account used for checkout.');
        setVerifying(false);
        toast({
          title: "User Authentication Mismatch",
          description: "Payment made with different account. Log in with your checkout email to unlock access.",
          variant: "destructive",
        });
        gotoFailedPage(planId, 'Invalid payment session - user mismatch', 2000, userId);
        return;
      }

      // --- Step 1: Verify/capture order with PayPal via edge function ---
      try {
        const { data: verify, error: verifyError } = await supabase.functions.invoke("verify-paypal-payment", {
          headers: {
            "Content-Type": "application/json",
            ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
          },
          body: {
            order_id: token,
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
          gotoFailedPage(planId, 'Authentication expired', 1000, userId);
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
          gotoFailedPage(planId, 'PayPal payment could not be verified - please contact support', 2000, userId);
          return;
        }

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
          gotoFailedPage(planId, 'Could not confirm PayPal payment - missing payment ID', 2000, userId);
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
          gotoFailedPage(planId, 'Subscription activation failed after successful payment', 2000, userId);
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
        gotoFailedPage(planId, 'Payment verification failed - system error', 2000, userId);
      }
    };

    verifyAndActivate();
    // eslint-disable-next-line
  }, [user, navigate, params]);
}
