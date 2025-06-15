
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getPayPalConfig } from './paypalConfig.ts';
import { fetchPayPalAccessToken } from './paypalToken.ts';
import { getSiteUrl } from './siteUrl.ts';
import { makeSupabaseClient, insertTransaction, updateTransactionOnCapture, createUserSubscription } from './dbOperations.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const { action, orderId, planId, userId, amount } = await req.json();
    const supabaseClient = makeSupabaseClient();
    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    const accessToken = await fetchPayPalAccessToken(baseUrl, clientId, clientSecret);

    if (action === 'create') {
      const siteUrl = getSiteUrl();
      const returnUrl = `${siteUrl}/payment/callback?success=true&plan_id=${planId}&user_id=${userId}`;
      const cancelUrl = `${siteUrl}/payment/callback?success=false&plan_id=${planId}&user_id=${userId}`;

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
              value: amount.toString()
            },
            description: `Subscription Plan Purchase`
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
        console.error('PayPal order creation failed:', orderData);
        throw new Error(`PayPal order creation failed: ${orderData.message}`);
      }

      const { error: dbError } = await insertTransaction(supabaseClient, {
        userId,
        planId,
        paypalOrderId: orderData.id,
        amount
      });

      if (dbError) {
        console.error('Database error (insert transaction):', dbError);
        throw new Error('Failed to create transaction record');
      }

      console.log('PayPal order created successfully:', {
        orderId: orderData.id,
        status: orderData.status,
        links: orderData.links
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
        console.error('Missing required fields for capture:', { orderId, userId, planId });
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
        console.error('PayPal capture failed:', { orderId, captureData });
        throw new Error(`PayPal capture failed: ${captureData.message}`);
      }

      const paymentId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      const paymentStatus = captureData.status;

      if (!paymentId) {
        console.error('PayPal capture: paymentId missing in response', { orderId, captureData });
        throw new Error('PayPal capture did not return a paymentId.');
      }

      console.log('PayPal payment captured:', {
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
        console.error('Transaction update error (on capture):', updateError, { orderId, paymentId });
        throw new Error('Failed to update transaction after capture');
      }

      if (paymentStatus === 'COMPLETED') {
        const { error: subscriptionError } = await createUserSubscription(supabaseClient, {
          userId,
          planId,
          paymentId,
          transactionId: transaction.id
        });

        if (subscriptionError) {
          console.error('Subscription creation error after capture:', subscriptionError);
          // Payment was successful - just log subscription error, don't abort
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
    console.error('PayPal processing error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
