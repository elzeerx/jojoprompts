import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { normalizePaymentParams } from "./helpers/normalizePaymentParams";
import { gotoFailedPage } from "./helpers/gotoFailedPage";
import { recoverSession } from "./helpers/useSessionRecovery";
import { verifyPayPalPayment } from "./helpers/paymentVerifier";
import { activateSubscription } from "./helpers/subscriptionActivator";
import { handleVerificationError } from "./helpers/paymentErrorHandler";
import { supabase } from "@/integrations/supabase/client";

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
    const { planId, userId, token, payerId } = normalizePaymentParams(params);

    setVerifying(true);

    async function processPayment() {
      // Session restoration
      const { user: activeUser, session } = await recoverSession(user);

      if (!planId || !userId || !token) {
        handleVerificationError({
          errorTitle: "Missing Info",
          errorMsg: "Missing payment information",
          toastMsg: "Missing payment information - please try again",
          navigate, planId, userId, setError, setVerifying,
        });
        return;
      }

      // Fallback: No session
      if (!activeUser) {
        // Check for existing subscription in DB
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

          handleVerificationError({
            errorTitle: "Authentication Required (Session Lost)",
            errorMsg: "You must be logged in to complete your payment (session expired/lost). If you already paid, please log back in to unlock access.",
            toastMsg: "Your payment was likely successful! Please log in to access premium content.",
            navigate, planId, userId, setError, setVerifying,
          });
        } catch (e) {
          handleVerificationError({
            errorTitle: "Session Lost",
            errorMsg: "Payment session timeout or invalid. Please try again.",
            navigate, planId, userId, setError, setVerifying,
          });
        }
        return;
      }

      if (userId !== activeUser.id) {
        handleVerificationError({
          errorTitle: "User Authentication Mismatch",
          errorMsg: "Payment session does not match your account. Please sign in with the account used for checkout.",
          toastMsg: "Payment made with a different account. Log in with your checkout email to unlock access.",
          navigate, planId, userId, setError, setVerifying,
        });
        return;
      }

      // Step 1: Verify payment
      const { data: verify, error: verifyError } = await verifyPayPalPayment(token, payerId, session?.access_token);

      // ---- IMPROVED ERROR DIAGNOSTICS FOR PAYPAL EDGE FUNCTION ----
      if (verifyError?.status === 401 || verifyError?.message?.toLowerCase().includes("authorization")) {
        handleVerificationError({
          errorTitle: "Session Expired",
          errorMsg: "Authentication expired. Please log in again to complete your payment.",
          navigate, planId, userId, setError, setVerifying,
        });
        return;
      }

      // If PayPal edge function returned error with errorTips or requestId, surface it
      if (verifyError || !verify || !(verify.status === "COMPLETED")) {
        let tips: string[] = [];
        let diagnosticText: string = "";
        if (verify?.errorTips) tips = verify.errorTips;
        if (verify?.requestId) diagnosticText += `Request ID: ${verify.requestId}\n`;
        if (verify?.allParams) diagnosticText += `Parameters: ${JSON.stringify(verify.allParams)}\n`;
        if (verify?.error) diagnosticText += `Details: ${verify.error}\n`;

        handleVerificationError({
          errorTitle: "Payment Verification Error",
          errorMsg: (
            "Unable to verify payment completion. " +
            (tips.length ? "\n" + tips.join("\n") : "") +
            (diagnosticText ? "\n---\n" + diagnosticText : "")
          ),
          toastMsg: verifyError?.message || verify?.error || "Your PayPal payment could not be verified. Please contact support.",
          navigate, planId, userId, setError, setVerifying,
        });
        return;
      }

      const paypal_payment_id =
        verify.paymentId ||
        verify.paypal?.purchase_units?.[0]?.payments?.captures?.[0]?.id ||
        verify.paypal?.id ||
        verify?.paypal_payment_id || undefined;
      if (!paypal_payment_id) {
        handleVerificationError({
          errorTitle: "Payment Error",
          errorMsg: "Unable to determine PayPal payment ID.",
          toastMsg: "We could not confirm your PayPal payment. Please contact support.",
          navigate, planId, userId, setError, setVerifying,
        });
        return;
      }

      // Step 2: Activate subscription
      const { data: create, error: createError } = await activateSubscription({
        planId,
        userId,
        paymentMethod: "paypal",
        paymentId: paypal_payment_id,
        paymentDetails: verify.paypal,
        accessToken: session?.access_token,
      });

      if (createError || !create || !create.success) {
        handleVerificationError({
          errorTitle: "Subscription Error",
          errorMsg: "Subscription activation failed",
          toastMsg: "Your payment was successful, but we were unable to activate your subscription. Please contact support.",
          navigate, planId, userId, setError, setVerifying,
        });
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
    }

    processPayment();
    // eslint-disable-next-line
  }, [user, navigate, params]);
}
