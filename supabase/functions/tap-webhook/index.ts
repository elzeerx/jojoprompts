
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const TAP_WEBHOOK_SECRET = Deno.env.get("TAP_WEBHOOK_SECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
};

async function verifyWebhookSignature(body: string, signature: string): Promise<boolean> {
  if (!TAP_WEBHOOK_SECRET) {
    console.log("TAP_WEBHOOK_SECRET not configured, skipping signature verification");
    return true; // Skip verification in test mode
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(TAP_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
    
    const bodyBytes = encoder.encode(body);
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, bodyBytes);
    
    return isValid;
  } catch (error) {
    console.error("Signature verification error:", error);
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
    const signature = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
    
    console.log("Webhook received:", { 
      hasSignature: !!signature,
      bodyLength: body.length,
      timestamp: new Date().toISOString()
    });

    // Verify webhook signature (optional in test mode)
    if (signature && !(await verifyWebhookSignature(body, signature))) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401
      });
    }

    const event = JSON.parse(body);
    console.log("Processing webhook event:", { 
      type: event.type, 
      id: event.id, 
      status: event.status,
      timestamp: new Date().toISOString()
    });

    // Log webhook event for debugging
    const { error: logError } = await supabase
      .from('payments_log')
      .insert({
        tap_charge: event.id,
        status: event.status || event.type,
        user_id: '00000000-0000-0000-0000-000000000000', // Will be updated below
        payload: event,
        logged_at: new Date().toISOString()
      });

    if (logError) {
      console.error("Failed to log webhook event:", logError);
    }

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('user_id, status')
      .eq('tap_charge_id', event.id)
      .single();

    if (paymentError || !payment) {
      console.error("Payment not found:", { chargeId: event.id, error: paymentError });
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404
      });
    }

    console.log("Found payment:", { userId: payment.user_id, currentStatus: payment.status });

    // Handle different event types - using both status and type fields
    const eventStatus = event.status || event.type;
    
    if (eventStatus === 'CAPTURED') {
      console.log("Processing CAPTURED event for charge:", event.id);
      
      // Update payment status
      const { error: updateError } = await supabase
        .from('payments')
        .update({ status: 'CAPTURED' })
        .eq('tap_charge_id', event.id);

      if (updateError) {
        console.error("Failed to update payment status:", updateError);
        throw updateError;
      }

      // Upgrade user profile to basic tier
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ membership_tier: 'basic' })
        .eq('id', payment.user_id);

      if (profileError) {
        console.error("Failed to upgrade user profile:", profileError);
        throw profileError;
      }

      console.log("Payment captured and user upgraded:", { 
        chargeId: event.id, 
        userId: payment.user_id 
      });

    } else if (['FAILED', 'CANCELLED', 'DECLINED', 'VOIDED', 'ERROR'].includes(eventStatus)) {
      console.log("Processing failure event:", { type: eventStatus, chargeId: event.id });
      
      // Update payment status to failed
      const { error: updateError } = await supabase
        .from('payments')
        .update({ status: eventStatus })
        .eq('tap_charge_id', event.id);

      if (updateError) {
        console.error("Failed to update payment status:", updateError);
        throw updateError;
      }

      console.log("Payment status updated to failure:", { 
        chargeId: event.id, 
        status: eventStatus 
      });

    } else {
      console.log("Updating payment status for event:", { type: eventStatus, chargeId: event.id });
      
      // Update payment status for other events (INITIATED, PENDING, etc.)
      const { error: updateError } = await supabase
        .from('payments')
        .update({ status: eventStatus })
        .eq('tap_charge_id', event.id);

      if (updateError) {
        console.error("Failed to update payment status:", updateError);
        throw updateError;
      }
    }

    // Always respond with 200 OK to Tap
    return new Response(JSON.stringify({ received: true, processed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("Webhook processing error:", error);
    
    // Still return 200 to prevent Tap from retrying, but log the error
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
