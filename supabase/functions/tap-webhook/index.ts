
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, hashstring',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Rate limiting storage
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Input validation utilities
function validateWebhookPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (!payload.id || typeof payload.id !== 'string') return false;
  if (!payload.status || typeof payload.status !== 'string') return false;
  return true;
}

function sanitizePayload(payload: any): any {
  // Remove any potentially harmful properties and ensure basic structure
  return {
    id: String(payload.id || '').slice(0, 100),
    status: String(payload.status || '').slice(0, 50),
    amount: payload.amount ? Number(payload.amount) : null,
    currency: String(payload.currency || '').slice(0, 10),
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
    created: payload.created ? String(payload.created).slice(0, 50) : null
  };
}

// Rate limiting function
function isRateLimited(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }
  
  if (record.count >= maxRequests) {
    return true;
  }
  
  record.count++;
  return false;
}

// Verify webhook signature
async function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.replace('sha256=', '');
    
    // Create expected signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return expectedSignature === cleanSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
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
    
    if (!tapWebhookSecret) {
      console.error('TAP_WEBHOOK_SECRET not configured')
      return new Response('Configuration error', { status: 500, headers: corsHeaders })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Rate limiting check
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(clientIp, 20, 60000)) { // 20 requests per minute
      console.warn('Rate limit exceeded for IP:', clientIp);
      return new Response('Rate limit exceeded', { status: 429, headers: corsHeaders });
    }
    
    // Get the webhook payload
    const payloadText = await req.text()
    console.log('Raw webhook payload:', payloadText)
    
    // Verify webhook signature
    const hashstring = req.headers.get('hashstring')
    if (!hashstring) {
      console.error('Missing hashstring header')
      return new Response('Missing signature', { status: 400, headers: corsHeaders })
    }
    
    const isValidSignature = await verifyWebhookSignature(payloadText, hashstring, tapWebhookSecret);
    if (!isValidSignature) {
      console.error('Invalid webhook signature')
      return new Response('Invalid signature', { status: 401, headers: corsHeaders })
    }
    
    console.log('Webhook signature verified successfully')
    
    // Parse and validate payload
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch (error) {
      console.error('Invalid JSON payload:', error);
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }
    
    if (!validateWebhookPayload(payload)) {
      console.error('Invalid payload structure:', payload);
      return new Response('Invalid payload', { status: 400, headers: corsHeaders });
    }
    
    // Sanitize payload
    const sanitizedPayload = sanitizePayload(payload);
    console.log('Sanitized webhook payload:', JSON.stringify(sanitizedPayload, null, 2))
    
    // Extract charge information
    const chargeId = sanitizedPayload.id
    const status = sanitizedPayload.status
    const userId = sanitizedPayload.metadata?.user_id
    
    console.log('Processing webhook:', { chargeId, status, userId })
    
    // Log webhook event to payments_log table with sanitized payload
    const { error: logError } = await supabase
      .from('payments_log')
      .insert({
        user_id: userId,
        tap_charge: chargeId,
        status: status,
        payload: sanitizedPayload
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
