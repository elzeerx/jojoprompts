
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from "https://deno.land/std@0.177.0/crypto/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, hashstring',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  console.log('Tap webhook received:', req.method, req.url)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const tapWebhookSecret = Deno.env.get('TAP_WEBHOOK_SECRET')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get the webhook payload
    const payload = await req.json()
    console.log('Webhook payload received:', JSON.stringify(payload, null, 2))
    
    // Verify webhook signature
    const hashstring = req.headers.get('hashstring')
    if (!hashstring) {
      console.error('Missing hashstring header')
      return new Response('Missing signature', { status: 400, headers: corsHeaders })
    }
    
    // Create HMAC hash of the payload
    const payloadString = JSON.stringify(payload)
    const expectedHash = await createHmac('sha256', tapWebhookSecret).update(payloadString).digest('hex')
    const providedHash = hashstring.replace('sha256=', '')
    
    if (expectedHash !== providedHash) {
      console.error('Invalid webhook signature')
      return new Response('Invalid signature', { status: 401, headers: corsHeaders })
    }
    
    console.log('Webhook signature verified successfully')
    
    // Extract charge information
    const chargeId = payload.id
    const status = payload.status
    const userId = payload.metadata?.user_id
    
    console.log('Processing webhook:', { chargeId, status, userId })
    
    // Log webhook event to payments_log table
    const { error: logError } = await supabase
      .from('payments_log')
      .insert({
        user_id: userId,
        tap_charge: chargeId,
        status: status,
        payload: payload
      })
    
    if (logError) {
      console.error('Error logging webhook:', logError)
    } else {
      console.log('Webhook event logged successfully')
    }
    
    // Check if this webhook has already been processed (idempotency)
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('tap_charge', chargeId)
      .single()
    
    if (existingSubscription) {
      console.log('Webhook already processed for charge:', chargeId)
      return new Response('Already processed', { status: 200, headers: corsHeaders })
    }
    
    // Process CAPTURED payments
    if (status === 'CAPTURED' && userId) {
      console.log('Processing CAPTURED payment for user:', userId)
      
      // Set subscription period to 30 days from now
      const currentPeriodEnd = new Date()
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30)
      
      // Create or update subscription
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          status: 'active',
          current_period_end: currentPeriodEnd.toISOString(),
          tap_charge: chargeId
        })
      
      if (subscriptionError) {
        console.error('Error creating subscription:', subscriptionError)
        return new Response('Subscription creation failed', { status: 500, headers: corsHeaders })
      }
      
      console.log('Subscription created successfully for user:', userId)
    } else {
      console.log('Webhook status not CAPTURED or missing user_id:', { status, userId })
    }
    
    return new Response('Webhook processed successfully', { status: 200, headers: corsHeaders })
    
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response('Internal server error', { status: 500, headers: corsHeaders })
  }
})
