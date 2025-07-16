
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
  // Fetch plan details to check if it's lifetime
  const { data: planData } = await supabaseClient
    .from('subscription_plans')
    .select('is_lifetime, duration_days')
    .eq('id', planId)
    .single();

  // Calculate end_date based on plan type
  let endDate = null;
  if (planData && !planData.is_lifetime) {
    const durationDays = planData.duration_days || 365; // Default to 1 year if not specified
    endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
  }

  return supabaseClient
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_id: planId,
      payment_method: 'paypal',
      payment_id: paymentId,
      transaction_id: transactionId,
      status: 'active',
      end_date: endDate // NULL for lifetime plans, calculated date for regular plans
    });
}

// Handle subscription upgrade
export async function upgradeUserSubscription(supabaseClient: any, { currentSubscriptionId, newPlanId, paymentId, transactionId }: any) {
  // Get user ID from current subscription first
  const { data: currentSub, error: fetchError } = await supabaseClient
    .from('user_subscriptions')
    .select('user_id, plan_id')
    .eq('id', currentSubscriptionId)
    .single();

  if (fetchError || !currentSub) {
    throw new Error('Failed to fetch current subscription details');
  }

  // Cancel ALL current active subscriptions for this user (safety measure)
  const { error: cancelError } = await supabaseClient
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', currentSub.user_id)
    .eq('status', 'active');

  if (cancelError) {
    throw new Error(`Failed to cancel current subscriptions: ${cancelError.message}`);
  }

  // Fetch plan details to check if it's lifetime
  const { data: planData } = await supabaseClient
    .from('subscription_plans')
    .select('is_lifetime, duration_days')
    .eq('id', newPlanId)
    .single();

  // Calculate end_date based on plan type
  let endDate = null;
  if (planData && !planData.is_lifetime) {
    const durationDays = planData.duration_days || 365; // Default to 1 year if not specified
    endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
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
      end_date: endDate // NULL for lifetime plans, calculated date for regular plans
    });
}
