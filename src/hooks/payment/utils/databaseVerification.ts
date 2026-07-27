
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionResult } from "../types/paymentProcessingTypes";

/**
 * Checks DB for active subscription or recent completed transaction
 */
export async function checkDatabaseFirst({
  userId,
  planId,
  orderId,
}: {
  userId?: string | null;
  planId?: string | null;
  orderId?: string | null;
}): Promise<SubscriptionResult> {
  if (!userId || !planId) {
    // V2 release-hardening: the retired `get-transaction-by-order` Edge
    // Function is no longer invoked. Without an authenticated user + planId
    // we cannot verify entitlement, so we fail closed.
    return { hasSubscription: false, transaction: null, subscription: null };
  }

  // Check subscriptions - including discount-based payments
  const { data: sub, error: subErr } = await supabase
    .from("user_subscriptions")
    .select("id, payment_id, created_at, transaction_id, user_id, status, payment_method")
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (sub && sub.length) {
    // Found active subscription - could be PayPal or discount-based
    return { hasSubscription: true, subscription: sub[0], transaction: null };
  }

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, paypal_payment_id, status, user_id, plan_id, created_at")
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .eq("status", "completed")
    .gte("created_at", thirtyMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  if (tx && tx.length) {
    return {
      hasSubscription: true,
      transaction: tx[0],
      subscription: {
        transaction_id: tx[0].id,
        payment_id: tx[0].paypal_payment_id,
        user_id: tx[0].user_id
      }
    };
  }
  return { hasSubscription: false, transaction: null, subscription: null };
}
