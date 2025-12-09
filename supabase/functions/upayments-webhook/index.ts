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

    logger.info('Received Upayments webhook', { 
      paymentId: body.payment_id,
      invoiceId: body.invoice_id,
      status: body.result,
      orderId: body.order_id
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

    // Find transaction by track_id or invoice_id
    let query = supabaseClient.from('transactions').select('*');
    if (track_id) {
      query = query.eq('upayments_track_id', track_id);
    } else if (invoice_id) {
      query = query.eq('upayments_invoice_id', invoice_id);
    } else {
      logger.error('No track_id or invoice_id in webhook payload');
      return new Response(JSON.stringify({ success: false, error: 'Missing identifier' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: transaction, error: txError } = await query.single();

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
