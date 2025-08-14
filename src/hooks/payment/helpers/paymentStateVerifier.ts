
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/utils/safeLogging";

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
    safeLog.debug('Starting payment state verification:', { userId, planId, orderId, paymentId });

    try {
      // Phase 1: Check for active subscription first
      if (userId && planId) {
        const { data: subscription } = await supabase
          .from("user_subscriptions")
          .select("id, status, payment_id, transaction_id, created_at, payment_method")
          .eq("user_id", userId)
          .eq("plan_id", planId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .maybeSingle();

        if (subscription) {
          safeLog.debug('Found active subscription, payment was successful');
          // Check if this is a discount-based payment
          const isDiscountPayment = subscription.payment_method === 'discount_100_percent' || 
                                   (subscription.payment_id && subscription.payment_id.startsWith('discount_'));
          
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
          safeLog.debug('Found transaction:', transaction.status);
          
          if (transaction.status === "completed") {
            // Check if subscription was created for this transaction
            const { data: sub } = await supabase
              .from("user_subscriptions")
              .select("id, status, payment_id, payment_method")
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

      // Phase 3: Check for discount-based transactions without order ID
      if (userId && planId) {
        const { data: discountTransaction } = await supabase
          .from("transactions")
          .select("id, status, paypal_payment_id, created_at")
          .eq("user_id", userId)
          .eq("plan_id", planId)
          .eq("status", "completed")
          .is("paypal_order_id", null) // Discount transactions don't have PayPal order IDs
          .order("created_at", { ascending: false })
          .maybeSingle();

        if (discountTransaction && discountTransaction.paypal_payment_id?.startsWith('discount_')) {
          // Check if subscription exists for this discount transaction
          const { data: sub } = await supabase
            .from("user_subscriptions")
            .select("id, status, payment_id, payment_method")
            .eq("user_id", userId)
            .eq("plan_id", planId)
            .eq("status", "active")
            .eq("transaction_id", discountTransaction.id)
            .maybeSingle();

          if (sub) {
            safeLog.debug('Found discount-based subscription, payment was successful');
            return {
              isSuccessful: true,
              hasActiveSubscription: true,
              subscription: sub,
              transaction: discountTransaction,
              needsAuthentication: false
            };
          }
        }
      }

      // Phase 4: If no definitive state found, return uncertain
      return {
        isSuccessful: false,
        hasActiveSubscription: false,
        needsAuthentication: !userId,
        errorMessage: "Payment status could not be determined"
      };

    } catch (error) {
      safeLog.error('Payment state verification error:', error);
      return {
        isSuccessful: false,
        hasActiveSubscription: false,
        needsAuthentication: true,
        errorMessage: "Unable to verify payment status"
      };
    }
  }
}
