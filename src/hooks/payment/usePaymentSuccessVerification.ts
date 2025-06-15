
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { normalizePaymentParams } from "./helpers/normalizePaymentParams";
import { gotoFailedPage } from "./helpers/gotoFailedPage";
import { retrySessionFetch } from "./helpers/retrySessionFetch";

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
    const { planId, userId, token, payerId, allParams } = normalizePaymentParams(params);

    // Enhanced logs for debugging
    console.log("[PaymentSuccessVerification] params normalized:", { planId, userId, token, payerId, allParams });
    setVerifying(true);

    const verifyAndActivate = async () => {
      // Try to get session (with retries if session is undefined)
      let sessionData;
      let activeUser = user;
      try {
        // 1st attempt: direct from context, fallback to supabase.getSession
        sessionData = await supabase.auth.getSession();
        if (sessionData.data?.session?.user) {
          activeUser = sessionData.data.session.user;
        }
        // If still no user, try retrySessionFetch for more robustness
        if (!activeUser) {
          const recovered = await retrySessionFetch();
          if (recovered?.user) {
            activeUser = recovered.user;
            console.log("[PaymentSuccessVerification] Session recovered via retry.");
          }
        }
      } catch (error) {
        console.warn("[PaymentSuccessVerification] Failed to fetch session", error);
      }

      if (!planId || !userId || !token) {
        setError('Missing payment information');
        setVerifying(false);
        gotoFailedPage(navigate, planId, 'Missing payment information - please try again', 1500, userId);
        return;
      }

      // Fallback: no session/user, check DB activations
      if (!activeUser) {
        try {
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
            setTimeout(() => {
              setError("Payment complete. Please log in to unlock your plan.");
            }, 1500);
            return;
          }

          setError(
            'You must be logged in to complete your payment (session expired/lost). If you already paid, please log back in to unlock access.'
          );
          setVerifying(false);
          toast({
            title: "Authentication Required (Session Lost)",
            description: "Your payment was likely successful! Please log in to access premium content.",
            variant: "destructive",
          });
          gotoFailedPage(navigate, planId, "No authentication session", 2000, userId);
          return;
        } catch (e) {
          setError('Payment session timeout or invalid. Please try again.');
          setVerifying(false);
          gotoFailedPage(navigate, planId, "No authentication session", 2000, userId);
          return;
        }
      }

      if (userId !== activeUser.id) {
        setError('Payment session does not match your account. Please sign in with the account used for checkout.');
        setVerifying(false);
        toast({
          title: "User Authentication Mismatch",
          description: "Payment made with a different account. Log in with your checkout email to unlock access.",
          variant: "destructive",
        });
        gotoFailedPage(navigate, planId, 'Invalid payment session - user mismatch', 2000, userId);
        return;
      }

      try {
        const { data: verify, error: verifyError } = await supabase.functions.invoke("verify-paypal-payment", {
          headers: {
            "Content-Type": "application/json",
            ...(sessionData.data?.session?.access_token ? { Authorization: `Bearer ${sessionData.data.session.access_token}` } : {}),
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
          gotoFailedPage(navigate, planId, 'Authentication expired', 1000, userId);
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
          gotoFailedPage(navigate, planId, 'PayPal payment could not be verified - please contact support', 2000, userId);
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
          gotoFailedPage(navigate, planId, 'Could not confirm PayPal payment - missing payment ID', 2000, userId);
          return;
        }

        const { data: create, error: createError } = await supabase.functions.invoke("create-subscription", {
          headers: {
            "Content-Type": "application/json",
            ...(sessionData.data?.session?.access_token ? { Authorization: `Bearer ${sessionData.data.session.access_token}` } : {}),
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
          gotoFailedPage(navigate, planId, 'Subscription activation failed after successful payment', 2000, userId);
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
        gotoFailedPage(navigate, planId, 'Payment verification failed - system error', 2000, userId);
      }
    };

    verifyAndActivate();
    // eslint-disable-next-line
  }, [user, navigate, params]);
}
