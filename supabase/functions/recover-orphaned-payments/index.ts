
// --- NOTE ---
// The helper functions below are duplicated from supabase/functions/verify-paypal-payment/dbOperations.ts
// because Supabase Edge Functions cannot import code outside their folder.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

// --- Duplicated utils ---
function makeSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

// New function to find and recover orphaned completed transactions
async function findAndRecoverOrphanedTransactions(supabaseClient: any, { user_id, plan_id }: { user_id?: string, plan_id?: string }) {
  try {
    console.log('Looking for orphaned transactions to recover:', { user_id, plan_id });
    
    let query = supabaseClient
      .from('transactions')
      .select(`
        *,
        user_subscriptions!left(id)
      `)
      .eq('status', 'completed');

    if (user_id) query = query.eq('user_id', user_id);
    if (plan_id) query = query.eq('plan_id', plan_id);

    // Find completed transactions without subscriptions
    const { data: orphanedTransactions, error: qErr } = await query;
    if (qErr) {
      return { recovered: 0, errors: [qErr] };
    }

    const filtered = (orphanedTransactions ?? []).filter((t: any) => !t.user_subscriptions || t.user_subscriptions.length === 0);

    if (!filtered || filtered.length === 0) {
      return { recovered: 0, errors: [] };
    }

    console.log(`Found ${filtered.length} orphaned transactions`);
    
    const recoveryResults = [];
    for (const transaction of filtered) {
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

// Duplicated from dbOps
async function insertUserSubscriptionIfMissing(supabaseClient: any, { user_id, plan_id, payment_id, transaction_id }: any) {
  try {
    // Check if subscription already exists by payment_id or transaction_id
    const { data: existingSubs } = await supabaseClient
      .from('user_subscriptions')
      .select('*')
      .or(`payment_id.eq.${payment_id},transaction_id.eq.${transaction_id}`)
      .eq('status', 'active');

    if (existingSubs && existingSubs.length > 0) {
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
      // Update existing subscription with new payment info
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
    const subscriptionData = {
      user_id,
      plan_id,
      payment_method: 'paypal',
      payment_id,
      transaction_id,
      status: 'active',
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };

    const { data: newSub, error: insertError } = await supabaseClient
      .from('user_subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (insertError) {
      return { data: null, error: insertError };
    }

    return { data: newSub, error: null };

  } catch (error) {
    return { data: null, error };
  }
}

// --- Edge Function Logic ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let userId: string | undefined;
  try {
    const { userId: bodyUserId } = await req.json();
    userId = bodyUserId;
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Missing or invalid userId in body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!userId) {
    return new Response(JSON.stringify({ success: false, error: "userId required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const supabaseClient = makeSupabaseClient();
    const { recovered, errors } = await findAndRecoverOrphanedTransactions(supabaseClient, { user_id: userId });

    console.log(`[RECOVERY] Orphaned payments recovery for user ${userId}:`, { recovered, errors });

    return new Response(
      JSON.stringify({ success: true, recovered, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RECOVERY] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
