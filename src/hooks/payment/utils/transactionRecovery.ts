import { supabase } from "@/integrations/supabase/client";

/**
 * Finds a transaction by order ID.
 *
 * V2 release-hardening: the unauthenticated fallback path previously called
 * the retired `get-transaction-by-order` Edge Function. That call is removed;
 * unauthenticated lookups now return `null` (read-only clients cannot query
 * `transactions` directly under RLS, which is the correct outcome).
 */
export async function findTransactionByOrder(orderIdToFind: string, currentUser?: any) {
  if (!currentUser) {
    // Retired endpoint path — do not invoke `get-transaction-by-order`.
    return null;
  }

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("user_id, plan_id, paypal_payment_id, status, created_at, id")
    .eq("paypal_order_id", orderIdToFind)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !transactions || transactions.length === 0) {
    return null;
  }

  return transactions[0];
}
