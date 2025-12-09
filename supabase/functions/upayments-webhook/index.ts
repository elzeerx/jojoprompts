import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('upayments-webhook');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function makeSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Handle both JSON and form-urlencoded data from Upayments
    let body;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
      logger.info('Received form-urlencoded webhook data');
    } else {
      body = await req.json();
    }
    
    const supabaseClient = makeSupabaseClient();

    // Log ALL identifiers for debugging
    logger.info('Received Upayments webhook - ALL IDENTIFIERS', { 
      paymentId: body.payment_id,
      invoiceId: body.invoice_id,
      status: body.result,
      orderId: body.order_id,
      trackId: body.track_id,
      referenceId: body.reference?.id,
      customerId: body.customer?.uniqueId,
      allKeys: Object.keys(body)
    });

    // Extract relevant fields from webhook payload
    const {
      payment_id,
      invoice_id,
      order_id,
      track_id,
      result,
      amount,
      customer_email,
      customer_name
    } = body;

    // Try multiple strategies to find the transaction
    let transaction = null;
    let txError = null;

    // Strategy 1: Try track_id
    if (track_id) {
      const result = await supabaseClient.from('transactions').select('*').eq('upayments_track_id', track_id).single();
      if (!result.error && result.data) {
        transaction = result.data;
        logger.info('Found transaction by track_id', { trackId: track_id, txId: transaction.id });
      }
    }

    // Strategy 2: Try invoice_id
    if (!transaction && invoice_id) {
      const result = await supabaseClient.from('transactions').select('*').eq('upayments_invoice_id', invoice_id).single();
      if (!result.error && result.data) {
        transaction = result.data;
        logger.info('Found transaction by invoice_id', { invoiceId: invoice_id, txId: transaction.id });
      }
    }

    // Strategy 3: Try reference.id (which we set to transaction ID)
    if (!transaction && body.reference?.id) {
      // Reference ID might be shortened, try partial match
      const refId = body.reference.id;
      const result = await supabaseClient.from('transactions').select('*').ilike('id', `${refId}%`).single();
      if (!result.error && result.data) {
        transaction = result.data;
        logger.info('Found transaction by reference.id', { refId, txId: transaction.id });
      }
    }

    // Strategy 4: Parse order_id for user_id and plan_id
    if (!transaction && order_id) {
      // order_id format: order_{userId.slice(0,8)}_{planId.slice(0,8)}_{timestamp}
      const parts = order_id.split('_');
      if (parts.length >= 4) {
        const userIdPrefix = parts[1];
        const planIdPrefix = parts[2];
        
        // Find pending transaction for this user/plan combination
        const result = await supabaseClient
          .from('transactions')
          .select('*')
          .ilike('user_id', `${userIdPrefix}%`)
          .ilike('plan_id', `${planIdPrefix}%`)
          .eq('status', 'pending')
          .eq('payment_gateway', 'upayments')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!result.error && result.data) {
          transaction = result.data;
          logger.info('Found transaction by order_id parsing', { orderId: order_id, txId: transaction.id });
        }
      }
    }

    // Strategy 5: Try customer.uniqueId (which is userId) + pending status
    if (!transaction && body.customer?.uniqueId) {
      const result = await supabaseClient
        .from('transactions')
        .select('*')
        .eq('user_id', body.customer.uniqueId)
        .eq('status', 'pending')
        .eq('payment_gateway', 'upayments')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!result.error && result.data) {
        transaction = result.data;
        logger.info('Found transaction by customer.uniqueId', { uniqueId: body.customer.uniqueId, txId: transaction.id });
      }
    }

    if (txError || !transaction) {
      logger.error('Transaction not found for webhook', { track_id, invoice_id, error: txError });
      return new Response(JSON.stringify({ success: false, error: 'Transaction not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if already processed
    if (transaction.status === 'completed') {
      logger.info('Transaction already completed, skipping', { transactionId: transaction.id });
      return new Response(JSON.stringify({ success: true, message: 'Already processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process based on result
    const isSuccess = result === 'CAPTURED' || result === 'SUCCESS' || result === 'PAID';

    if (isSuccess) {
      // Update transaction to completed
      await supabaseClient
        .from('transactions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          upayments_invoice_id: invoice_id || transaction.upayments_invoice_id
        })
        .eq('id', transaction.id);

      // Fetch plan details
      const { data: planData } = await supabaseClient
        .from('subscription_plans')
        .select('is_lifetime, duration_days, name')
        .eq('id', transaction.plan_id)
        .single();

      let endDate = null;
      if (planData && !planData.is_lifetime) {
        const durationDays = planData.duration_days || 365;
        endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      }

      // Check for existing active subscription
      const { data: existingSub } = await supabaseClient
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', transaction.user_id)
        .eq('status', 'active')
        .single();

      if (!existingSub) {
        // Create subscription
        await supabaseClient
          .from('user_subscriptions')
          .insert({
            user_id: transaction.user_id,
            plan_id: transaction.plan_id,
            payment_method: 'upayments',
            payment_id: payment_id || invoice_id,
            transaction_id: transaction.id,
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: endDate
          });

        logger.info('Subscription created via webhook', { userId: transaction.user_id, planId: transaction.plan_id });
      }

      // Auto-confirm email
      try {
        await supabaseClient.auth.admin.updateUserById(transaction.user_id, { email_confirm: true });
      } catch (e) {
        logger.warn('Failed to confirm email via webhook', { error: e });
      }

      // Send confirmation email
      try {
        const { data: userProfile } = await supabaseClient
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', transaction.user_id)
          .single();

        if (userProfile?.email && planData) {
          const userName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'User';
          
          await supabaseClient.functions.invoke('send-email', {
            body: {
              to: userProfile.email,
              template_slug: 'payment_confirmation',
              email_type: 'payment_confirmation',
              variables: {
                first_name: userName.split(' ')[0] || 'Valued Customer',
                plan_name: planData.name,
                amount: `${transaction.amount_usd} KWD`,
                transaction_id: transaction.id,
                purchase_date: new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }),
                email: userProfile.email
              }
            }
          });
        }
      } catch (e) {
        logger.warn('Failed to send email via webhook', { error: e });
      }

      logger.info('Webhook processed successfully - payment completed', { transactionId: transaction.id });

    } else {
      // Payment failed
      await supabaseClient
        .from('transactions')
        .update({ status: 'failed' })
        .eq('id', transaction.id);

      logger.info('Webhook processed - payment failed', { transactionId: transaction.id, result });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Webhook processing error', { error: error.message });
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
