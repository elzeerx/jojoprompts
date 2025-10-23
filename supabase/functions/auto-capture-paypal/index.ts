import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { createEdgeLogger, generateRequestId } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PayPal configuration
function getPayPalConfig() {
  const environment = Deno.env.get('PAYPAL_ENVIRONMENT') || 'sandbox';
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }
  
  const baseUrl = environment === 'production' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
    
  return { clientId, clientSecret, baseUrl };
}

// Get PayPal access token
async function getPayPalAccessToken(baseUrl: string, clientId: string, clientSecret: string) {
  const auth = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }
  
  const data = await response.json();
  return data.access_token;
}

// Check PayPal order status
async function checkPayPalOrder(baseUrl: string, accessToken: string, orderId: string) {
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  });
  
  if (!response.ok) {
    return { ok: false, data: null };
  }
  
  const data = await response.json();
  return { ok: true, data };
}

// Capture PayPal order
async function capturePayPalOrder(baseUrl: string, accessToken: string, orderId: string) {
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  });
  
  if (!response.ok) {
    return { ok: false, data: null };
  }
  
  const data = await response.json();
  return { ok: true, data };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const logger = createEdgeLogger('AUTO_CAPTURE_PAYPAL', requestId);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    const accessToken = await getPayPalAccessToken(baseUrl, clientId, clientSecret);

    logger.info('Starting automatic PayPal capture process');

    // Get all pending transactions with PayPal order IDs
    const { data: pendingTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, paypal_order_id, paypal_payment_id, user_id, plan_id, amount_usd, status, created_at')
      .eq('status', 'pending')
      .not('paypal_order_id', 'is', null)
      .is('paypal_payment_id', null)
      .order('created_at', { ascending: false })
      .limit(50); // Process up to 50 at a time

    if (fetchError) {
      logger.error('Error fetching pending transactions', { error: fetchError.message });
      throw new Error('Failed to fetch pending transactions');
    }

    if (!pendingTransactions || pendingTransactions.length === 0) {
      logger.info('No pending transactions found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending transactions to process',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    logger.info('Pending transactions found', { count: pendingTransactions.length });

    const results = {
      processed: 0,
      captured: 0,
      failed: 0,
      expired: 0,
      skipped: 0,
      details: [] as any[]
    };

    // Process each pending transaction
    for (const transaction of pendingTransactions) {
      const txLogger = logger.child({ txId: transaction.id.slice(0, 8) });
      
      try {
        results.processed++;
        
        // Check if transaction is older than 24 hours
        const transactionAge = Date.now() - new Date(transaction.created_at).getTime();
        const isOlderThan24Hours = transactionAge > 24 * 60 * 60 * 1000;
        
        if (isOlderThan24Hours) {
          txLogger.warn('Transaction older than 24 hours, marking as expired');
          await supabase
            .from('transactions')
            .update({
              status: 'failed',
              error_message: 'Transaction expired - older than 24 hours',
              completed_at: new Date().toISOString()
            })
            .eq('id', transaction.id);
          
          results.expired++;
          results.details.push({
            transactionId: transaction.id,
            orderId: transaction.paypal_order_id,
            status: 'expired',
            reason: 'older than 24 hours'
          });
          continue;
        }

        // Check PayPal order status
        txLogger.debug('Checking PayPal order status', { orderId: transaction.paypal_order_id });
        const orderResult = await checkPayPalOrder(baseUrl, accessToken, transaction.paypal_order_id);
        
        if (!orderResult.ok) {
          txLogger.error('Failed to check PayPal order status');
          results.failed++;
          results.details.push({
            transactionId: transaction.id,
            orderId: transaction.paypal_order_id,
            status: 'failed',
            reason: 'unable to check order status'
          });
          continue;
        }

        const orderData = orderResult.data;
        txLogger.info('PayPal order status retrieved', { status: orderData.status });

        if (orderData.status === 'APPROVED') {
          // Attempt to capture the order
          txLogger.info('Order approved, attempting capture');
          const captureResult = await capturePayPalOrder(baseUrl, accessToken, transaction.paypal_order_id);
          
          if (captureResult.ok && captureResult.data) {
            const captureData = captureResult.data;
            const paymentId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
            
            if (paymentId && captureData.status === 'COMPLETED') {
              txLogger.info('Payment captured successfully', { paymentId });
              
              // Update transaction
              const { error: updateError } = await supabase
                .from('transactions')
                .update({
                  status: 'completed',
                  paypal_payment_id: paymentId,
                  completed_at: new Date().toISOString()
                })
                .eq('id', transaction.id);

              if (updateError) {
                txLogger.error('Error updating transaction', { error: updateError.message });
                results.failed++;
                continue;
              }

              // Create user subscription if it doesn't exist
              const { data: existingSubscription } = await supabase
                .from('user_subscriptions')
                .select('id')
                .eq('user_id', transaction.user_id)
                .eq('plan_id', transaction.plan_id)
                .eq('status', 'active')
                .maybeSingle();

              if (!existingSubscription) {
                txLogger.info('Creating user subscription');
                const { error: subscriptionError } = await supabase
                  .from('user_subscriptions')
                  .insert({
                    user_id: transaction.user_id,
                    plan_id: transaction.plan_id,
                    payment_method: 'paypal',
                    payment_id: paymentId,
                    transaction_id: transaction.id,
                    status: 'active',
                    start_date: new Date().toISOString()
                  });

                if (subscriptionError) {
                  txLogger.error('Error creating subscription', { error: subscriptionError.message });
                  // Don't fail the capture, just log
                }
              }

              results.captured++;
              results.details.push({
                transactionId: transaction.id,
                orderId: transaction.paypal_order_id,
                paymentId,
                status: 'captured',
                amount: transaction.amount_usd
              });
            } else {
              txLogger.error('Capture failed or incomplete');
              results.failed++;
              results.details.push({
                transactionId: transaction.id,
                orderId: transaction.paypal_order_id,
                status: 'capture_failed',
                reason: 'no payment ID returned'
              });
            }
          } else {
            txLogger.error('Failed to capture order');
            results.failed++;
            results.details.push({
              transactionId: transaction.id,
              orderId: transaction.paypal_order_id,
              status: 'capture_failed',
              reason: 'PayPal capture API failed'
            });
          }
        } else if (orderData.status === 'COMPLETED') {
          // Already completed, check if we have the payment ID
          const paymentId = orderData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
          if (paymentId) {
            txLogger.info('Order already completed, updating transaction');
            await supabase
              .from('transactions')
              .update({
                status: 'completed',
                paypal_payment_id: paymentId,
                completed_at: new Date().toISOString()
              })
              .eq('id', transaction.id);

            results.captured++;
            results.details.push({
              transactionId: transaction.id,
              orderId: transaction.paypal_order_id,
              paymentId,
              status: 'already_completed'
            });
          }
        } else if (['CANCELLED', 'VOIDED', 'EXPIRED'].includes(orderData.status)) {
          txLogger.warn('Order cancelled/voided/expired, marking transaction as failed');
          await supabase
            .from('transactions')
            .update({
              status: 'failed',
              error_message: `PayPal order ${orderData.status.toLowerCase()}`,
              completed_at: new Date().toISOString()
            })
            .eq('id', transaction.id);

          results.failed++;
          results.details.push({
            transactionId: transaction.id,
            orderId: transaction.paypal_order_id,
            status: 'failed',
            reason: `order ${orderData.status.toLowerCase()}`
          });
        } else {
          txLogger.warn('Order in unexpected status', { status: orderData.status });
          results.skipped++;
          results.details.push({
            transactionId: transaction.id,
            orderId: transaction.paypal_order_id,
            status: 'skipped',
            paypalStatus: orderData.status
          });
        }

      } catch (error) {
        txLogger.error('Error processing transaction', { error: error.message });
        results.failed++;
        results.details.push({
          transactionId: transaction.id,
          orderId: transaction.paypal_order_id,
          status: 'error',
          error: error.message
        });
      }

      // Add small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Auto-capture completed', results);

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${results.processed} transactions`,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Auto-capture error', { error: error.message });
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});