
import { PostgrestError, createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

export function makeSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

// Insert transaction
export async function insertTransaction(supabaseClient: any, { userId, planId, paypalOrderId, amount }: any) {
  return supabaseClient
    .from('transactions')
    .insert({
      user_id: userId,
      plan_id: planId,
      paypal_order_id: paypalOrderId,
      amount_usd: amount,
      status: 'pending'
    });
}

// Update transaction on capture
export async function updateTransactionOnCapture(supabaseClient: any, { orderId, paymentId, paymentStatus }: any) {
  return supabaseClient
    .from('transactions')
    .update({
      paypal_payment_id: paymentId,
      status: paymentStatus === 'COMPLETED' ? 'completed' : 'failed',
      completed_at: new Date().toISOString(),
      error_message: paymentStatus !== 'COMPLETED' ? 'Payment not completed' : null
    })
    .eq('paypal_order_id', orderId)
    .select()
    .single();
}

// Create subscription on completed payment
export async function createUserSubscription(supabaseClient: any, { userId, planId, paymentId, transactionId }: any) {
  return supabaseClient
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_id: planId,
      payment_method: 'paypal',
      payment_id: paymentId,
      transaction_id: transactionId,
      status: 'active',
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    });
}
