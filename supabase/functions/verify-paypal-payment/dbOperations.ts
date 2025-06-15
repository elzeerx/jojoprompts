
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

export function makeSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

// Fetch latest matching transaction
export async function getTransaction(supabaseClient: any, { orderId, paymentId }: { orderId?: string, paymentId?: string }) {
  let query = supabaseClient.from("transactions").select("*").order("created_at", { ascending: false }).limit(1);
  if (orderId && paymentId) {
    query = query.or(`paypal_order_id.eq.${orderId},paypal_payment_id.eq.${paymentId}`);
  } else if (orderId) {
    query = query.eq("paypal_order_id", orderId);
  } else if (paymentId) {
    query = query.eq("paypal_payment_id", paymentId);
  }
  return query.maybeSingle();
}

export async function updateTransactionCompleted(supabaseClient: any, { id, paypal_payment_id }: { id: string, paypal_payment_id: string }) {
  return supabaseClient.from('transactions').update({
    paypal_payment_id,
    status: 'completed',
    completed_at: new Date().toISOString(),
    error_message: null
  }).eq('id', id);
}

export async function insertUserSubscriptionIfMissing(supabaseClient: any, { user_id, plan_id, payment_id, transaction_id }: any) {
  // Only insert if not already a subscription
  const { data: subs } = await supabaseClient.from('user_subscriptions')
    .select('*')
    .eq('user_id', user_id)
    .eq('plan_id', plan_id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (!subs || subs.length === 0) {
    await supabaseClient.from('user_subscriptions').insert({
      user_id,
      plan_id,
      payment_method: 'paypal',
      payment_id,
      transaction_id,
      status: 'active',
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
}
