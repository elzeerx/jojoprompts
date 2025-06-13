
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_WEBHOOK_ID = Deno.env.get("PAYPAL_WEBHOOK_ID");
const PAYPAL_ENVIRONMENT = Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
};

function getPayPalApiUrl(): string {
  return PAYPAL_ENVIRONMENT === 'production' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken(): Promise<string> {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  
  const response = await fetch(`${getPayPalApiUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json();
  return data.access_token;
}

async function verifyWebhookSignature(body: string, headers: Headers): Promise<boolean> {
  if (!PAYPAL_WEBHOOK_ID) {
    console.log("PAYPAL_WEBHOOK_ID not configured, skipping signature verification");
    return true;
  }

  try {
    const accessToken = await getPayPalAccessToken();
    
    const verificationPayload = {
      auth_algo: headers.get('PAYPAL-AUTH-ALGO'),
      cert_id: headers.get('PAYPAL-CERT-ID'),
      transmission_id: headers.get('PAYPAL-TRANSMISSION-ID'),
      transmission_sig: headers.get('PAYPAL-TRANSMISSION-SIG'),
      transmission_time: headers.get('PAYPAL-TRANSMISSION-TIME'),
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: JSON.parse(body)
    };

    const response = await fetch(`${getPayPalApiUrl()}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(verificationPayload)
    });

    if (!response.ok) {
      console.error('PayPal webhook verification failed:', response.status);
      return false;
    }

    const result = await response.json();
    return result.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405
    });
  }

  try {
    const body = await req.text();
    
    console.log("PayPal webhook received:", { 
      bodyLength: body.length,
      timestamp: new Date().toISOString()
    });

    // Verify webhook signature
    if (!(await verifyWebhookSignature(body, req.headers))) {
      console.error("Invalid PayPal webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401
      });
    }

    const event = JSON.parse(body);
    console.log("Processing PayPal webhook event:", { 
      type: event.event_type, 
      id: event.id,
      timestamp: new Date().toISOString()
    });

    // Log webhook event for debugging
    const { error: logError } = await supabase
      .from('payments_log')
      .insert({
        paypal_payment_id: event.resource?.id || event.id,
        status: event.event_type,
        user_id: '00000000-0000-0000-0000-000000000000', // Will be updated below
        payload: event,
        logged_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log webhook event:", logError);
    }

    // Handle different PayPal webhook events
    if (event.event_type === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = event.resource?.id;
      
      // Get payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('user_id, status')
        .eq('paypal_order_id', orderId)
        .single();

      if (paymentError || !payment) {
        console.error("Payment not found:", { orderId, error: paymentError });
        return new Response(JSON.stringify({ error: "Payment not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404
        });
      }

      // Update payment status
      const { error: updateError } = await supabase
        .from('payments')
        .update({ status: 'APPROVED' })
        .eq('paypal_order_id', orderId);

      if (updateError) {
        console.error("Failed to update payment status:", updateError);
      }

      console.log("PayPal order approved:", { orderId, userId: payment.user_id });

    } else if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const paymentId = event.resource?.id;
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
      
      // Get payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('user_id, status')
        .or(`paypal_payment_id.eq.${paymentId},paypal_order_id.eq.${orderId}`)
        .single();

      if (paymentError || !payment) {
        console.error("Payment not found:", { paymentId, orderId, error: paymentError });
        return new Response(JSON.stringify({ error: "Payment not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404
        });
      }

      // Update payment status and payment ID
      const { error: updateError } = await supabase
        .from('payments')
        .update({ 
          status: 'COMPLETED',
          paypal_payment_id: paymentId,
          paypal_payer_id: event.resource?.payer?.payer_id
        })
        .or(`paypal_payment_id.eq.${paymentId},paypal_order_id.eq.${orderId}`);

      if (updateError) {
        console.error("Failed to update payment status:", updateError);
      }

      // Upgrade user profile to basic tier
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ membership_tier: 'basic' })
        .eq('id', payment.user_id);

      if (profileError) {
        console.error("Failed to upgrade user profile:", profileError);
      }

      console.log("PayPal payment completed and user upgraded:", { 
        paymentId, 
        orderId,
        userId: payment.user_id 
      });
    }

    // Always respond with 200 OK to PayPal
    return new Response(JSON.stringify({ received: true, processed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("PayPal webhook processing error:", error);
    
    // Still return 200 to prevent PayPal from retrying
    return new Response(JSON.stringify({ 
      received: true, 
      processed: false, 
      error: "Webhook processing failed" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });
  }
});
