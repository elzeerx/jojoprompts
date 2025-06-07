
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    // Get the webhook secret for signature verification
    const webhookSecret = Deno.env.get("TAP_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("TAP_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }

    // Verify the signature
    const signature = req.headers.get("Tap-Signature");
    if (!signature) {
      console.error("Missing Tap-Signature header");
      return new Response(
        JSON.stringify({ error: "Missing signature" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const body = await req.text();
    console.log("Tap webhook received:", body);

    // Parse the webhook payload
    let event;
    try {
      event = JSON.parse(body);
    } catch (parseError) {
      console.error("Failed to parse webhook body:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check if this is a successful payment
    if (event.status !== "CAPTURED") {
      console.log("Payment not captured, status:", event.status);
      return new Response(
        JSON.stringify({ message: "Payment not captured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Extract charge details
    const chargeId = event.id;
    const planId = event.metadata?.udf2; // plan_id stored in metadata
    const userId = event.metadata?.udf1; // user_id stored in metadata

    if (!chargeId || !planId || !userId) {
      console.error("Missing required data in webhook:", { chargeId, planId, userId });
      return new Response(
        JSON.stringify({ error: "Missing required payment data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Creating subscription for:", { userId, planId, chargeId });

    // Create subscription using the RPC function
    const { data: result, error } = await supabase.rpc('create_subscription', {
      p_user_id: userId,
      p_plan_id: planId,
      p_tap_id: chargeId
    });

    if (error) {
      console.error("Failed to create subscription:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("Subscription creation result:", result);

    return new Response(
      JSON.stringify({ success: true, message: "Subscription created" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
