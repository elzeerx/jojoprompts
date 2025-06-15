
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

export function makeSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

// Enhanced transaction fetching with multiple fallback strategies
/**
 * Fetch a transaction by PayPal identifiers.
 *
 * When both an order ID and a payment ID are supplied the query requires
 * that **both** values match the same row.  Previously the function used an
 * `.or()` filter which allowed a row to match if either value was found.  The
 * new behaviour avoids accidentally returning the wrong transaction when one of
 * the IDs has been reused or is stale.
 */
export async function getTransaction(
  supabaseClient: any,
  { orderId, paymentId }: { orderId?: string; paymentId?: string },
) {
  let query =
    supabaseClient.from("transactions").select("*").order("created_at", {
      ascending: false,
    });

  if (orderId && paymentId) {
    // Require both PayPal identifiers to match the same transaction
    query = query.eq("paypal_order_id", orderId).eq("paypal_payment_id", paymentId);
  } else if (orderId) {
    query = query.eq("paypal_order_id", orderId);
  } else if (paymentId) {
    query = query.eq("paypal_payment_id", paymentId);
  }
  
  const result = await query.limit(1).maybeSingle();
  console.log('Transaction lookup result:', { orderId, paymentId, found: !!result.data });
  return result;
}

// Enhanced subscription creation with retry logic and proper error handling
export async function insertUserSubscriptionIfMissing(supabaseClient: any, { user_id, plan_id, payment_id, transaction_id }: any) {
  try {
    console.log('Checking for existing subscription:', { user_id, plan_id, payment_id });
    
    // Check if subscription already exists by payment_id or transaction_id
    const { data: existingSubs } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .or(`payment_id.eq.${payment_id},transaction_id.eq.${transaction_id}`)
      .eq('status', 'active');

    if (existingSubs && existingSubs.length > 0) {
      console.log('Subscription already exists:', existingSubs[0]);
      return { data: existingSubs[0], error: null };
    }

    // Check for existing active subscription for this user and plan
    const { data: userPlanSubs } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user_id)
      .eq('plan_id', plan_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (userPlanSubs && userPlanSubs.length > 0) {
      console.log('User already has active subscription for this plan:', userPlanSubs[0]);
      // Update existing subscription with new payment info instead of creating duplicate
      const { data: updatedSub, error: updateError } = await supabaseClient
        .from('user_subscriptions')
        .update({
          payment_id,
          transaction_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', userPlanSubs[0].id)
        .select()
        .single();

      return { data: updatedSub, error: updateError };
    }

    // Create new subscription
    console.log('Creating new subscription:', { user_id, plan_id, payment_id, transaction_id });
    const subscriptionData = {
      user_id,
      plan_id,
      payment_method: 'paypal',
      payment_id,
      transaction_id,
      status: 'active',
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
    };

    const { data: newSub, error: insertError } = await supabaseClient
      .from('user_subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create subscription:', insertError);
      return { data: null, error: insertError };
    }

    console.log('Successfully created subscription:', newSub);
    return { data: newSub, error: null };

  } catch (error) {
    console.error('Subscription creation failed with exception:', error);
    return { data: null, error };
  }
}

// Enhanced transaction completion with proper subscription handling
export async function updateTransactionCompleted(supabaseClient: any, { id, paypal_payment_id }: { id: string, paypal_payment_id: string }) {
  try {
    console.log('Updating transaction as completed:', { id, paypal_payment_id });
    
    const { data: transaction, error: updateError } = await supabaseClient
      .from('transactions')
      .update({
        paypal_payment_id,
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: null
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update transaction:', updateError);
      return { data: null, error: updateError };
    }

    // Ensure subscription is created for completed transaction
    if (transaction?.user_id && transaction?.plan_id) {
      const subscriptionResult = await insertUserSubscriptionIfMissing(supabaseClient, {
        user_id: transaction.user_id,
        plan_id: transaction.plan_id,
        payment_id: paypal_payment_id,
        transaction_id: transaction.id,
      });

      if (subscriptionResult.error) {
        console.error('Failed to create subscription for completed transaction:', subscriptionResult.error);
        // Don't fail the transaction update if subscription creation fails
        // The transaction is still marked as completed
      }
    }

    return { data: transaction, error: null };
  } catch (error) {
    console.error('Transaction completion failed:', error);
    return { data: null, error };
  }
}

// New function to find and recover orphaned completed transactions
export async function findAndRecoverOrphanedTransactions(supabaseClient: any, { user_id, plan_id }: { user_id?: string, plan_id?: string }) {
  try {
    console.log('Looking for orphaned transactions to recover:', { user_id, plan_id });
    
    let query = supabaseClient
      .from('transactions')
      .select(`
        *,
        user_subscriptions!inner(id)
      `)
      .eq('status', 'completed');

    if (user_id) query = query.eq('user_id', user_id);
    if (plan_id) query = query.eq('plan_id', plan_id);

    // Find completed transactions without subscriptions
    const { data: orphanedTransactions } = await query;

    if (!orphanedTransactions || orphanedTransactions.length === 0) {
      return { recovered: 0, errors: [] };
    }

    console.log(`Found ${orphanedTransactions.length} orphaned transactions`);
    
    const recoveryResults = [];
    for (const transaction of orphanedTransactions) {
      const result = await insertUserSubscriptionIfMissing(supabaseClient, {
        user_id: transaction.user_id,
        plan_id: transaction.plan_id,
        payment_id: transaction.paypal_payment_id,
        transaction_id: transaction.id,
      });
      
      recoveryResults.push({
        transaction_id: transaction.id,
        success: !result.error,
        error: result.error
      });
    }

    const successCount = recoveryResults.filter(r => r.success).length;
    const errors = recoveryResults.filter(r => !r.success).map(r => r.error);

    console.log(`Recovered ${successCount} orphaned transactions`);
    return { recovered: successCount, errors };

  } catch (error) {
    console.error('Error during orphaned transaction recovery:', error);
    return { recovered: 0, errors: [error] };
  }
}
