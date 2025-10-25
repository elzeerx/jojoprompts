
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getPayPalConfig } from './paypalConfig.ts';
import { fetchPayPalAccessToken } from './paypalToken.ts';
import { getSiteUrl } from './siteUrl.ts';
import { makeSupabaseClient, insertTransaction, updateTransactionOnCapture, createUserSubscription, upgradeUserSubscription } from './dbOperations.ts';
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('process-paypal-payment');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to sanitize amount for PayPal precision requirements
function sanitizeAmount(amount: number): { value: string; number: number } {
  // Convert to cents and back to fix floating point precision issues
  const centsValue = Math.round(amount * 100);
  const sanitizedNumber = centsValue / 100;
  const sanitizedString = sanitizedNumber.toFixed(2);
  
  logger.debug('Amount sanitization', {
    original: amount,
    centsValue,
    sanitizedNumber,
    sanitizedString
  });
  
  return {
    value: sanitizedString,      // For PayPal API (string with 2 decimals)
    number: sanitizedNumber      // For database storage (number)
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { action, orderId, planId, userId, amount, appliedDiscount, isUpgrade, upgradingFromPlanId, currentSubscriptionId } = await req.json();
    const supabaseClient = makeSupabaseClient();

    // Handle direct activation for 100% discounts
    if (action === 'direct-activation') {
      logger.info('Processing direct activation for 100% discount', { planId, userId, amount, appliedDiscount });

      if (amount !== 0) {
        throw new Error('Direct activation is only allowed for 100% discounts (amount must be $0)');
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
          paypal_order_id: null, // No PayPal order for direct activation
          paypal_payment_id: `discount_${appliedDiscount.code}_${Date.now()}` // Unique identifier for discount payment
        })
        .select()
        .single();

      if (transactionError || !transaction) {
        logger.error('Failed to create transaction for direct activation', { error: transactionError });
        throw new Error('Failed to create transaction record');
      }

      logger.info('Created transaction for direct activation', { transactionId: transaction.id });

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

      // Create active subscription
      const { data: subscription, error: subscriptionError } = await supabaseClient
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          payment_method: 'discount_100_percent',
          payment_id: transaction.paypal_payment_id,
          transaction_id: transaction.id,
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: endDate // NULL for lifetime plans, calculated date for regular plans
        })
        .select()
        .single();

      if (subscriptionError || !subscription) {
        logger.error('Failed to create subscription for direct activation', { error: subscriptionError });
        throw new Error('Failed to create subscription');
      }

      logger.info('Created subscription for direct activation', { subscriptionId: subscription.id });

      // Track discount usage
      const { error: discountUsageError } = await supabaseClient
        .from('discount_code_usage')
        .insert({
          discount_code_id: appliedDiscount.id,
          user_id: userId,
          used_at: new Date().toISOString()
        });

      if (discountUsageError) {
        logger.warn('Failed to track discount usage', { error: discountUsageError });
        // Don't throw error as the main transaction succeeded
      }

      // Increment discount usage count - fixed SQL update
      const { data: currentDiscount, error: fetchError } = await supabaseClient
        .from('discount_codes')
        .select('times_used')
        .eq('id', appliedDiscount.id)
        .single();

      if (!fetchError && currentDiscount) {
        const { error: incrementError } = await supabaseClient
          .from('discount_codes')
          .update({ 
            times_used: currentDiscount.times_used + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', appliedDiscount.id);

        if (incrementError) {
          logger.warn('Failed to increment discount usage', { error: incrementError });
          // Don't throw error as the main transaction succeeded
        }
      }

      return new Response(JSON.stringify({
        success: true,
        transactionId: transaction.id,
        subscriptionId: subscription.id,
        paymentId: transaction.paypal_payment_id, // Include paymentId for success handler
        paymentMethod: 'discount_100_percent',
        status: 'COMPLETED', // Include status for success handler
        message: 'Subscription activated successfully with 100% discount'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Regular PayPal flow for non-100% discounts
    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    const accessToken = await fetchPayPalAccessToken(baseUrl, clientId, clientSecret);

    if (action === 'create') {
      // Handle 0.00 amounts - redirect to direct activation
      if (amount === 0) {
        logger.info('Amount is 0.00, redirecting to direct activation path');
        return new Response(JSON.stringify({
          success: false,
          redirectToDirectActivation: true,
          message: 'Use direct activation for zero amounts'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const siteUrl = getSiteUrl();
      
      logger.info('Creating PayPal order', {
        amount,
        appliedDiscount,
        planId,
        userId
      });
      
      // Sanitize amount for PayPal precision requirements
      const sanitizedAmount = sanitizeAmount(amount);
      
      // FIXED: Include planId and userId in both return and cancel URLs with proper encoding
      const returnUrl = `${siteUrl}/payment/callback?success=true&plan_id=${encodeURIComponent(planId)}&user_id=${encodeURIComponent(userId)}`;
      const cancelUrl = `${siteUrl}/payment/callback?success=false&plan_id=${encodeURIComponent(planId)}&user_id=${encodeURIComponent(userId)}`;

      logger.debug('PayPal order URLs configured', { returnUrl, cancelUrl, planId, userId });

      const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: {
              currency_code: 'USD',
              value: sanitizedAmount.value  // Use sanitized string value
            },
            description: `Subscription Plan Purchase`,
            // ENHANCED: Add custom data that will persist through PayPal redirect
            custom_id: `${userId}:${planId}:${Date.now()}`,
            invoice_id: `inv_${userId}_${planId}_${Date.now()}`
          }],
          application_context: {
            return_url: returnUrl,
            cancel_url: cancelUrl,
            user_action: 'PAY_NOW',
            payment_method: {
              payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
            }
          }
        })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        logger.error('PayPal order creation failed', { orderData });
        throw new Error(`PayPal order creation failed: ${orderData.message}`);
      }

      // Enhanced transaction record with better metadata
      const transactionData = {
        userId,
        planId,
        paypalOrderId: orderData.id,
        amount: sanitizedAmount.number,  // Use sanitized number for database
        isUpgrade: isUpgrade || false,
        upgradingFromPlanId: upgradingFromPlanId || null
      };
      
      const { error: dbError } = await insertTransaction(supabaseClient, transactionData);

      if (dbError) {
        logger.error('Database error creating transaction', { error: dbError });
        throw new Error('Failed to create transaction record');
      }

      logger.info('PayPal order created successfully', {
        orderId: orderData.id,
        status: orderData.status,
        customId: `${userId}:${planId}:${Date.now()}`
      });

      return new Response(JSON.stringify({
        success: true,
        orderId: orderData.id,
        approvalUrl: orderData.links?.find((link: any) => link.rel === 'approve')?.href
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'capture') {
      if (!orderId || !userId || !planId) {
        logger.error('Missing required fields for capture', { orderId, userId, planId });
        return new Response(JSON.stringify({ success: false, error: 'Missing required fields for capture.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const captureData = await captureRes.json();
      if (!captureRes.ok) {
        logger.error('PayPal capture failed', { orderId, captureData });
        throw new Error(`PayPal capture failed: ${captureData.message}`);
      }

      const paymentId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      const paymentStatus = captureData.status;

      if (!paymentId) {
        logger.error('PayPal capture: paymentId missing in response', { orderId, captureData });
        throw new Error('PayPal capture did not return a paymentId.');
      }

      logger.info('PayPal payment captured', {
        orderId,
        paymentId,
        status: paymentStatus,
        userId,
        planId
      });

      const { data: transaction, error: updateError } = await updateTransactionOnCapture(supabaseClient, {
        orderId,
        paymentId,
        paymentStatus
      });

      if (updateError || !transaction) {
        logger.error('Transaction update error on capture', { error: updateError, orderId, paymentId });
        throw new Error('Failed to update transaction after capture');
      }

      if (paymentStatus === 'COMPLETED') {
        // Record discount usage if a discount was applied
        if (appliedDiscount && appliedDiscount.id) {
          logger.info('Recording discount usage', { discountId: appliedDiscount.id, userId, transactionId: transaction.id });
          try {
            const { data: usageRecorded, error: usageError } = await supabaseClient.rpc('record_discount_usage', {
              discount_code_id_param: appliedDiscount.id,
              user_id_param: userId,
              payment_history_id_param: transaction.id
            });

            if (usageError) {
              logger.warn('Failed to record discount usage', { error: usageError });
              // Don't fail the payment, just log the error
            } else if (usageRecorded) {
              logger.info('Discount usage recorded successfully');
            } else {
              logger.info('Discount usage not recorded (possibly already used)');
            }
          } catch (error) {
            logger.error('Error recording discount usage', { error });
            // Don't fail the payment, just log the error
          }
        }

        // Check if this is an upgrade transaction
        if (transaction.is_upgrade && currentSubscriptionId) {
          logger.info('Processing subscription upgrade', { currentSubscriptionId, planId });
          const { error: upgradeError } = await upgradeUserSubscription(supabaseClient, {
            currentSubscriptionId,
            newPlanId: planId,
            paymentId,
            transactionId: transaction.id
          });

          if (upgradeError) {
            logger.error('Subscription upgrade error after capture', { error: upgradeError });
            // Payment was successful - just log upgrade error, don't abort
          }
        } else {
          // Regular new subscription
          const { error: subscriptionError } = await createUserSubscription(supabaseClient, {
            userId,
            planId,
            paymentId,
            transactionId: transaction.id
          });

          if (subscriptionError) {
            logger.error('Subscription creation error after capture', { error: subscriptionError });
            // Payment was successful - just log subscription error, don't abort
          }
        }
      }

      return new Response(JSON.stringify({
        success: paymentStatus === 'COMPLETED',
        status: paymentStatus,
        paymentId: paymentId,
        transactionId: transaction.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    logger.error('PayPal processing error', { error });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
