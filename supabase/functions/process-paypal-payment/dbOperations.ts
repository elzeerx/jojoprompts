
import { PostgrestError, createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

export function makeSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

// Insert transaction
export async function insertTransaction(supabaseClient: any, { userId, planId, paypalOrderId, amount, isUpgrade, upgradingFromPlanId }: any) {
  return supabaseClient
    .from('transactions')
    .insert({
      user_id: userId,
      plan_id: planId,
      paypal_order_id: paypalOrderId,
      amount_usd: amount,
      status: 'pending',
      is_upgrade: isUpgrade || false,
      upgrade_from_plan_id: upgradingFromPlanId || null
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

// Handle subscription upgrade
export async function upgradeUserSubscription(supabaseClient: any, { currentSubscriptionId, newPlanId, paymentId, transactionId }: any) {
  // Cancel the current subscription
  const { error: cancelError } = await supabaseClient
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', currentSubscriptionId);

  if (cancelError) {
    throw new Error(`Failed to cancel current subscription: ${cancelError.message}`);
  }

  // Get user ID from current subscription
  const { data: currentSub, error: fetchError } = await supabaseClient
    .from('user_subscriptions')
    .select('user_id, plan_id')
    .eq('id', currentSubscriptionId)
    .single();

  if (fetchError || !currentSub) {
    throw new Error('Failed to fetch current subscription details');
  }

  // Create new subscription with upgraded plan
  return supabaseClient
    .from('user_subscriptions')
    .insert({
      user_id: currentSub.user_id,
      plan_id: newPlanId,
      payment_method: 'paypal',
      payment_id: paymentId,
      transaction_id: transactionId,
      status: 'active',
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    });
}
