
import { supabase } from "@/integrations/supabase/client";

interface VerificationResult {
  isSuccessful: boolean;
  hasActiveSubscription: boolean;
  subscription?: any;
  transaction?: any;
  needsAuthentication: boolean;
  errorMessage?: string;
}

export class PaymentStateVerifier {
  static async verifyPaymentState(
    userId?: string,
    planId?: string,
    orderId?: string,
    paymentId?: string
  ): Promise<VerificationResult> {
    console.log('Starting payment state verification:', { userId, planId, orderId, paymentId });

    try {
      // Phase 1: Check for active subscription first
      if (userId && planId) {
        const { data: subscription } = await supabase
          .from("user_subscriptions")
          .select("id, status, payment_id, transaction_id, created_at")
          .eq("user_id", userId)
          .eq("plan_id", planId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .maybeSingle();

        if (subscription) {
          console.log('Found active subscription, payment was successful');
          return {
            isSuccessful: true,
            hasActiveSubscription: true,
            subscription,
            needsAuthentication: false
          };
        }
      }

      // Phase 2: Check transaction status by order ID
      if (orderId) {
        const { data: transaction } = await supabase
          .from("transactions")
          .select("id, status, user_id, plan_id, paypal_payment_id, created_at")
          .eq("paypal_order_id", orderId)
          .order("created_at", { ascending: false })
          .maybeSingle();

        if (transaction) {
          console.log('Found transaction:', transaction.status);
          
          if (transaction.status === "completed") {
            // Check if subscription was created for this transaction
            const { data: sub } = await supabase
              .from("user_subscriptions")
              .select("id, status, payment_id")
              .eq("user_id", transaction.user_id)
              .eq("plan_id", transaction.plan_id)
              .eq("status", "active")
              .eq("transaction_id", transaction.id)
              .maybeSingle();

            return {
              isSuccessful: true,
              hasActiveSubscription: !!sub,
              subscription: sub,
              transaction,
              needsAuthentication: !userId || userId !== transaction.user_id
            };
          } else if (transaction.status === "failed" || transaction.status === "cancelled") {
            return {
              isSuccessful: false,
              hasActiveSubscription: false,
              transaction,
              needsAuthentication: false,
              errorMessage: `Payment ${transaction.status}`
            };
          }
        }
      }

      // Phase 3: If no definitive state found, return uncertain
      return {
        isSuccessful: false,
        hasActiveSubscription: false,
        needsAuthentication: !userId,
        errorMessage: "Payment status could not be determined"
      };

    } catch (error) {
      console.error('Payment state verification error:', error);
      return {
        isSuccessful: false,
        hasActiveSubscription: false,
        needsAuthentication: true,
        errorMessage: "Unable to verify payment status"
      };
    }
  }
}
