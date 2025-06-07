
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey, Tap-Signature",
};

// Enhanced logging for webhook processing
const logWebhook = (step: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[TAP-WEBHOOK ${timestamp}] ${step}`, data ? JSON.stringify(data, null, 2) : '');
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    logWebhook("ERROR: Invalid method", { method: req.method });
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    logWebhook("Webhook received");

    // Get the webhook secret for signature verification
    const webhookSecret = Deno.env.get("TAP_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logWebhook("ERROR: TAP_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }

    // Get the signature from headers
    const signature = req.headers.get("Tap-Signature");
    if (!signature) {
      logWebhook("ERROR: Missing Tap-Signature header");
      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const body = await req.text();
    logWebhook("Webhook body received", { bodyLength: body.length });

    // Verify signature (basic implementation - Tap's actual signature verification may differ)
    // Note: This is a placeholder - actual Tap signature verification would need their specific algorithm
    logWebhook("Signature verification", { providedSignature: signature });

    // Parse the webhook payload
    let event;
    try {
      event = JSON.parse(body);
      logWebhook("Parsed webhook event", { 
        eventId: event.id, 
        status: event.status, 
        amount: event.amount 
      });
    } catch (parseError) {
      logWebhook("ERROR: Failed to parse webhook body", { error: parseError.message });
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check if this is a successful payment
    if (event.status !== "CAPTURED") {
      logWebhook("Payment not captured", { status: event.status, eventId: event.id });
      return new Response(
        JSON.stringify({ message: "Payment not captured", status: event.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Extract charge details
    const chargeId = event.id;
    const planId = event.metadata?.udf2; // plan_id stored in metadata
    const userId = event.metadata?.udf1; // user_id stored in metadata
    const amount = event.amount;

    if (!chargeId || !planId || !userId) {
      logWebhook("ERROR: Missing required data", { chargeId, planId, userId });
      return new Response(
        JSON.stringify({ error: "Missing required payment data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    logWebhook("Processing successful payment", { userId, planId, chargeId, amount });

    // Check if subscription already exists to prevent duplicates
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('provider_tx_id', chargeId)
      .single();

    if (existingSubscription) {
      logWebhook("Subscription already exists", { chargeId });
      return new Response(
        JSON.stringify({ success: true, message: "Subscription already processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Create subscription using the RPC function
    const { data: result, error } = await supabase.rpc('create_subscription', {
      p_user_id: userId,
      p_plan_id: planId,
      p_tap_id: chargeId
    });

    if (error) {
      logWebhook("ERROR: Failed to create subscription", { error: error.message });
      return new Response(
        JSON.stringify({ error: "Failed to create subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    logWebhook("Subscription created successfully", { result });

    // Record payment in payment history
    const { error: paymentHistoryError } = await supabase
      .from('payment_history')
      .insert({
        user_id: userId,
        payment_id: chargeId,
        amount_usd: amount / 100, // Convert from cents
        amount_kwd: 0, // Will be calculated based on exchange rate
        status: 'completed',
        payment_method: 'tap'
      });

    if (paymentHistoryError) {
      logWebhook("WARNING: Failed to record payment history", { error: paymentHistoryError.message });
    }

    logWebhook("Webhook processing completed successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Subscription created and payment recorded" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    logWebhook("CRITICAL ERROR: Webhook processing failed", { error: error.message });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
