import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { createEdgeLogger } from '../_shared/logger.ts';
import { logEmailAttempt } from '../_shared/emailLogger.ts';

const logger = createEdgeLogger('process-upayments-payment');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KWD pricing map (USD to KWD fixed conversion)
const PLAN_KWD_PRICES: Record<number, number> = {
  55: 15,
  65: 20,
  80: 25,
  100: 30
};

function getKWDPrice(usdPrice: number): number {
  return PLAN_KWD_PRICES[usdPrice] || Math.round(usdPrice * 0.31);
}

function getSiteUrl(): string {
  const rawFrontendUrl = Deno.env.get('FRONTEND_URL');
  if (rawFrontendUrl) {
    return rawFrontendUrl.replace(/\/+$/, '');
  }
  // Hardcoded production fallback
  return 'https://jojoprompts.com';
}

function makeSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

function getUpayConfig() {
  const environment = Deno.env.get('UPAYMENTS_ENVIRONMENT') || 'sandbox';
  const apiToken = Deno.env.get('UPAYMENTS_API_TOKEN');
  
  if (!apiToken) {
    throw new Error('UPAYMENTS_API_TOKEN is not configured');
  }
  
  const baseUrl = environment === 'production' 
    ? 'https://uapi.upayments.com/api/v1'
    : 'https://sandboxapi.upayments.com/api/v1';
  
  return { baseUrl, apiToken, environment };
}

// Email sending function (mirrors PayPal implementation)
async function sendPaymentConfirmationEmail(
  supabaseClient: any,
  recipientEmail: string,
  userName: string,
  planName: string,
  amount: number,
  currency: string,
  transactionId: string,
  loggerInstance: any
): Promise<void> {
  try {
    loggerInstance.info('Attempting to send payment confirmation email', { recipientEmail, planName, amount, currency });

    const purchaseDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const payload = {
      to: recipientEmail,
      template_slug: 'payment_confirmation',
      email_type: 'payment_confirmation',
      variables: {
        first_name: userName.split(' ')[0] || 'Valued Customer',
        plan_name: planName,
        amount: `${Number(amount || 0).toFixed(2)} ${currency}`,
        transaction_id: transactionId,
        purchase_date: purchaseDate,
        email: recipientEmail,
        unsubscribe_link: `${getSiteUrl()}/unsubscribe?email=${encodeURIComponent(recipientEmail)}&type=payment_confirmation`
      }
    };

    const { data: emailResponse, error: emailError } = await supabaseClient.functions.invoke('send-email', {
      body: payload
    });

    if (emailResponse?.unsubscribed) {
      loggerInstance.info('User is unsubscribed from payment emails', { recipientEmail });
      await logEmailAttempt(supabaseClient, recipientEmail, 'payment_confirmation', true, 'User unsubscribed');
      return;
    }

    if (emailError) {
      loggerInstance.error('Failed to send payment confirmation email', { error: emailError });
      await logEmailAttempt(supabaseClient, recipientEmail, 'payment_confirmation', false, emailError.message);
    } else {
      loggerInstance.info('Payment confirmation email sent successfully', { recipientEmail });
      await logEmailAttempt(supabaseClient, recipientEmail, 'payment_confirmation', true);
    }
  } catch (error) {
    loggerInstance.error('Exception while sending payment confirmation email', { error });
    await logEmailAttempt(supabaseClient, recipientEmail, 'payment_confirmation', false, error.message);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const supabaseClient = makeSupabaseClient();
    const { action, planId, userId, amountKWD, amountUSD, appliedDiscount, language } = rawBody;

    logger.info('Processing Upayments request', { action, planId, userId, amountKWD, amountUSD });

    // Handle direct activation for 100% discounts (reuses same logic as PayPal)
    if (action === 'direct-activation') {
      logger.info('Processing direct activation for 100% discount via Upayments', { planId, userId });

      if (amountKWD !== 0) {
        throw new Error('Direct activation is only allowed for 100% discounts (amount must be 0)');
      }

      if (!appliedDiscount) {
        throw new Error('Applied discount information is required for direct activation');
      }

      // Create completed transaction record
      const { data: transaction, error: transactionError } = await supabaseClient
        .from('transactions')
        .insert({
          user_id: userId,
          plan_id: planId,
          amount_usd: 0,
          status: 'completed',
          completed_at: new Date().toISOString(),
          payment_gateway: 'upayments',
          currency: 'KWD',
          upayments_invoice_id: `discount_${appliedDiscount.code}_${Date.now()}`
        })
        .select()
        .single();

      if (transactionError || !transaction) {
        logger.error('Failed to create transaction for direct activation', { error: transactionError });
        throw new Error('Failed to create transaction record');
      }

      // Fetch plan details
      const { data: planData } = await supabaseClient
        .from('subscription_plans')
        .select('is_lifetime, duration_days')
        .eq('id', planId)
        .single();

      let endDate = null;
      if (planData && !planData.is_lifetime) {
        const durationDays = planData.duration_days || 365;
        endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      }

      // Create active subscription
      const { data: subscription, error: subscriptionError } = await supabaseClient
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          payment_method: 'discount_100_percent_upayments',
          payment_id: transaction.upayments_invoice_id,
          transaction_id: transaction.id,
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: endDate
        })
        .select()
        .single();

      if (subscriptionError || !subscription) {
        logger.error('Failed to create subscription for direct activation', { error: subscriptionError });
        throw new Error('Failed to create subscription');
      }

      // Auto-confirm user email
      try {
        await supabaseClient.auth.admin.updateUserById(userId, { email_confirm: true });
      } catch (confirmErr) {
        logger.warn('Exception auto-confirming email', { error: confirmErr });
      }

      // Track discount usage
      await supabaseClient.from('discount_code_usage').insert({
        discount_code_id: appliedDiscount.id,
        user_id: userId,
        used_at: new Date().toISOString()
      });

      // Increment discount usage count
      const { data: currentDiscount } = await supabaseClient
        .from('discount_codes')
        .select('times_used')
        .eq('id', appliedDiscount.id)
        .single();

      if (currentDiscount) {
        await supabaseClient
          .from('discount_codes')
          .update({ times_used: currentDiscount.times_used + 1, updated_at: new Date().toISOString() })
          .eq('id', appliedDiscount.id);
      }

      return new Response(JSON.stringify({
        success: true,
        transactionId: transaction.id,
        subscriptionId: subscription.id,
        paymentId: transaction.upayments_invoice_id,
        paymentMethod: 'discount_100_percent_upayments',
        status: 'COMPLETED',
        message: 'Subscription activated successfully with 100% discount'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // CREATE action - Create Upayments charge and get redirect URL
    if (action === 'create') {
      const { baseUrl, apiToken, environment } = getUpayConfig();
      const siteUrl = getSiteUrl();
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

      // Fetch user and plan details
      const { data: userProfile } = await supabaseClient
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', userId)
        .single();

      const { data: planDetails } = await supabaseClient
        .from('subscription_plans')
        .select('name, price_usd')
        .eq('id', planId)
        .single();

      if (!userProfile || !planDetails) {
        throw new Error('User or plan not found');
      }

      const userName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Customer';
      const userEmail = userProfile.email || '';
      const orderId = `order_${userId.slice(0, 8)}_${planId.slice(0, 8)}_${Date.now()}`;
      const trackId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create pending transaction
      const { data: transaction, error: txError } = await supabaseClient
        .from('transactions')
        .insert({
          user_id: userId,
          plan_id: planId,
          amount_usd: amountUSD,
          status: 'pending',
          payment_gateway: 'upayments',
          currency: 'KWD',
          upayments_track_id: trackId
        })
        .select()
        .single();

      if (txError || !transaction) {
        logger.error('Failed to create pending transaction', { error: txError });
        throw new Error('Failed to create transaction record');
      }

      // Build Upayments request (non-whitelabel - no paymentGateway.src)
      const upayRequestBody = {
        products: [{
          name: `JojoPrompts ${planDetails.name}`,
          description: `JojoPrompts ${planDetails.name} Subscription`,
          price: amountKWD,
          quantity: 1
        }],
        order: {
          id: orderId,
          reference: transaction.id,
          description: `JojoPrompts ${planDetails.name} Subscription`,
          currency: 'KWD',
          amount: amountKWD
        },
        reference: {
          id: transaction.id.replace(/-/g, '').substring(0, 32)
        },
        customer: {
          uniqueId: userId,
          name: userName,
          email: userEmail
        },
        language: language || 'en',
        returnUrl: `${siteUrl}/payment/upayments-callback?success=true&plan_id=${encodeURIComponent(planId)}&user_id=${encodeURIComponent(userId)}&track_id=${encodeURIComponent(trackId)}`,
        cancelUrl: `${siteUrl}/payment/upayments-callback?success=false&plan_id=${encodeURIComponent(planId)}&user_id=${encodeURIComponent(userId)}&track_id=${encodeURIComponent(trackId)}`,
        notificationUrl: `${supabaseUrl}/functions/v1/upayments-webhook`
      };

      logger.info('Creating Upayments charge', { 
        orderId, 
        trackId, 
        amountKWD, 
        environment,
        transactionId: transaction.id,
        returnUrl: upayRequestBody.returnUrl,
        cancelUrl: upayRequestBody.cancelUrl,
        siteUrl
      });

      const response = await fetch(`${baseUrl}/charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(upayRequestBody)
      });

      // Get raw response text first to handle non-JSON responses
      const responseText = await response.text();
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        logger.error('Failed to parse Upayments response', { 
          status: response.status, 
          responseText: responseText.substring(0, 500),
          error: parseError.message 
        });
        throw new Error(`Upayments API returned invalid response (status ${response.status}): ${responseText.substring(0, 100)}`);
      }

      if (!response.ok || !responseData.status) {
        logger.error('Upayments charge creation failed', { responseData, status: response.status });
        throw new Error(responseData.message || 'Failed to create Upayments charge');
      }

      logger.info('Upayments charge created successfully', { 
        invoiceId: responseData.data?.invoiceId,
        link: responseData.data?.link 
      });

      // Update transaction with invoice ID
      if (responseData.data?.invoiceId) {
        await supabaseClient
          .from('transactions')
          .update({ upayments_invoice_id: responseData.data.invoiceId })
          .eq('id', transaction.id);
      }

      return new Response(JSON.stringify({
        success: true,
        approvalUrl: responseData.data?.link,
        invoiceId: responseData.data?.invoiceId,
        trackId: trackId,
        transactionId: transaction.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // VERIFY action - Check payment status and activate subscription
    if (action === 'verify') {
      const { trackId, invoiceId } = rawBody;
      
      logger.info('Verifying Upayments payment', { trackId, invoiceId, planId, userId });

      // Try multiple strategies to find the transaction
      let transaction = null;

      // Strategy 1: Try track_id
      if (trackId) {
        const result = await supabaseClient.from('transactions').select('*').eq('upayments_track_id', trackId).single();
        if (!result.error && result.data) {
          transaction = result.data;
          logger.info('Found transaction by track_id', { trackId, txId: transaction.id });
        }
      }

      // Strategy 2: Try invoice_id
      if (!transaction && invoiceId) {
        const result = await supabaseClient.from('transactions').select('*').eq('upayments_invoice_id', invoiceId).single();
        if (!result.error && result.data) {
          transaction = result.data;
          logger.info('Found transaction by invoice_id', { invoiceId, txId: transaction.id });
        }
      }

      // Strategy 3: Fallback - find by user_id + plan_id + pending status
      if (!transaction && userId && planId) {
        const result = await supabaseClient
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('plan_id', planId)
          .eq('status', 'pending')
          .eq('payment_gateway', 'upayments')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!result.error && result.data) {
          transaction = result.data;
          logger.info('Found transaction by user_id + plan_id fallback', { userId, planId, txId: transaction.id });
        }
      }

      if (!transaction) {
        logger.error('Transaction not found for verification after all strategies', { trackId, invoiceId, userId, planId });
        throw new Error('Transaction not found');
      }

      // If already completed, return success
      if (transaction.status === 'completed') {
        logger.info('Transaction already completed', { transactionId: transaction.id });
        return new Response(JSON.stringify({
          success: true,
          status: 'COMPLETED',
          transactionId: transaction.id,
          alreadyProcessed: true
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // For non-whitelabel, we rely on the return URL params or webhook
      // The success param from return URL indicates payment status
      const { paymentSuccess } = rawBody;

      if (paymentSuccess) {
        // Update transaction to completed
        const { error: updateError } = await supabaseClient
          .from('transactions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', transaction.id);

        if (updateError) {
          logger.error('Failed to update transaction status', { error: updateError });
          throw new Error('Failed to update transaction');
        }

        // Fetch plan details for subscription
        const { data: planData } = await supabaseClient
          .from('subscription_plans')
          .select('is_lifetime, duration_days, name, price_usd')
          .eq('id', transaction.plan_id)
          .single();

        let endDate = null;
        if (planData && !planData.is_lifetime) {
          const durationDays = planData.duration_days || 365;
          endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        }

        // Create subscription
        const { data: subscription, error: subError } = await supabaseClient
          .from('user_subscriptions')
          .insert({
            user_id: transaction.user_id,
            plan_id: transaction.plan_id,
            payment_method: 'upayments',
            payment_id: transaction.upayments_invoice_id || trackId,
            transaction_id: transaction.id,
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: endDate
          })
          .select()
          .single();

        if (subError) {
          logger.error('Failed to create subscription', { error: subError });
        }

        // Auto-confirm email
        try {
          await supabaseClient.auth.admin.updateUserById(transaction.user_id, { email_confirm: true });
        } catch (e) {
          logger.warn('Failed to confirm email', { error: e });
        }

        // Record discount usage if applicable
        if (appliedDiscount?.id) {
          await supabaseClient.from('discount_code_usage').insert({
            discount_code_id: appliedDiscount.id,
            user_id: transaction.user_id,
            used_at: new Date().toISOString()
          });

          const { data: currentDiscount } = await supabaseClient
            .from('discount_codes')
            .select('times_used')
            .eq('id', appliedDiscount.id)
            .single();

          if (currentDiscount) {
            await supabaseClient
              .from('discount_codes')
              .update({ times_used: currentDiscount.times_used + 1, updated_at: new Date().toISOString() })
              .eq('id', appliedDiscount.id);
          }
        }

        // Send confirmation email in background
        setTimeout(async () => {
          try {
            const { data: userProfile } = await supabaseClient
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', transaction.user_id)
              .single();

            if (userProfile?.email && planData) {
              const userName = `${userProfile.first_name} ${userProfile.last_name}`.trim() || 'User';
              await sendPaymentConfirmationEmail(
                supabaseClient,
                userProfile.email,
                userName,
                planData.name,
                transaction.amount_usd,
                'KWD',
                transaction.id,
                logger
              );
            }
          } catch (e) {
            logger.warn('Failed to send confirmation email', { error: e });
          }
        }, 0);

        return new Response(JSON.stringify({
          success: true,
          status: 'COMPLETED',
          transactionId: transaction.id,
          subscriptionId: subscription?.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        // Payment failed or cancelled
        await supabaseClient
          .from('transactions')
          .update({ status: 'failed' })
          .eq('id', transaction.id);

        return new Response(JSON.stringify({
          success: false,
          status: 'FAILED',
          transactionId: transaction.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    throw new Error('Invalid action. Must be "create", "verify", or "direct-activation"');

  } catch (error) {
    logger.error('Upayments processing error', { error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
