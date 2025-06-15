
import { supabase } from "@/integrations/supabase/client";

/**
 * Finds a transaction by order ID
 */
export async function findTransactionByOrder(orderIdToFind: string, currentUser?: any) {
  if (!currentUser) {
    const { data, error } = await supabase.functions.invoke('get-transaction-by-order', {
      body: { orderId: orderIdToFind }
    });
    if (!error && data && (data as any).transaction) {
      return (data as any).transaction;
    }
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
