
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, orderId, planId, userId, amount } = await req.json()
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
    const paypalEnvironment = Deno.env.get('PAYPAL_ENVIRONMENT') || 'sandbox'
    
    const paypalBaseUrl = paypalEnvironment === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com'

    // Get PayPal access token
    const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${paypalClientId}:${paypalClientSecret}`)}`
      },
      body: 'grant_type=client_credentials'
    })

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    if (action === 'create') {
      // Create PayPal order
      const orderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
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
          }]
        })
      })

      const orderData = await orderResponse.json()
      
      if (!orderResponse.ok) {
        throw new Error(`PayPal order creation failed: ${orderData.message}`)
      }

      // Create transaction record
      const { error: dbError } = await supabaseClient
        .from('transactions')
        .insert({
          user_id: userId,
          plan_id: planId,
          paypal_order_id: orderData.id,
          amount_usd: amount,
          status: 'pending'
        })

      if (dbError) {
        console.error('Database error:', dbError)
        throw new Error('Failed to create transaction record')
      }

      return new Response(JSON.stringify({
        success: true,
        orderId: orderData.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'capture') {
      // Capture PayPal payment
      const captureResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const captureData = await captureResponse.json()
      
      if (!captureResponse.ok) {
        throw new Error(`PayPal capture failed: ${captureData.message}`)
      }

      const paymentId = captureData.purchase_units[0]?.payments?.captures[0]?.id
      const paymentStatus = captureData.status

      // Update transaction record
      const { data: transaction, error: updateError } = await supabaseClient
        .from('transactions')
        .update({
          paypal_payment_id: paymentId,
          status: paymentStatus === 'COMPLETED' ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          error_message: paymentStatus !== 'COMPLETED' ? 'Payment not completed' : null
        })
        .eq('paypal_order_id', orderId)
        .select()
        .single()

      if (updateError) {
        console.error('Transaction update error:', updateError)
        throw new Error('Failed to update transaction')
      }

      // Create subscription if payment completed
      if (paymentStatus === 'COMPLETED') {
        const { error: subscriptionError } = await supabaseClient
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            plan_id: planId,
            payment_method: 'paypal',
            payment_id: paymentId,
            transaction_id: transaction.id,
            status: 'active',
            end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year from now
          })

        if (subscriptionError) {
          console.error('Subscription creation error:', subscriptionError)
          // Don't throw here - payment was successful, just log the error
        }
      }

      return new Response(JSON.stringify({
        success: paymentStatus === 'COMPLETED',
        status: paymentStatus,
        paymentId: paymentId,
        transactionId: transaction.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('PayPal processing error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
