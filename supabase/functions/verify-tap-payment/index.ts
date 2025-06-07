
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
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
    const { tap_id } = await req.json();

    console.log("verify-tap-payment: Starting verification for tap_id:", tap_id);

    if (!tap_id) {
      console.error("verify-tap-payment: Missing tap_id in request");
      return new Response(
        JSON.stringify({ error: "Missing tap_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const tapKey = Deno.env.get("TAP_SECRET_KEY");
    if (!tapKey) {
      console.error("verify-tap-payment: TAP_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }

    console.log("verify-tap-payment: Making request to Tap API for charge:", tap_id);

    // Fetch charge details from Tap
    const response = await fetch(`https://api.tap.company/v2/charges/${encodeURIComponent(tap_id)}`, {
      headers: {
        "Authorization": `Bearer ${tapKey}`,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();
    console.log("verify-tap-payment: Tap API response status:", response.status);
    console.log("verify-tap-payment: Tap API response body:", text);

    if (!response.ok) {
      console.error("verify-tap-payment: Tap API returned error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Failed to fetch charge", details: text, status: response.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: response.status }
      );
    }

    let data;
    try {
      data = JSON.parse(text);
      console.log("verify-tap-payment: Parsed charge data:", {
        id: data.id,
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        metadata: data.metadata
      });
    } catch (parseError) {
      console.error("verify-tap-payment: Failed to parse Tap response:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid response from payment gateway" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    // Check if payment is captured
    if (data.status !== "CAPTURED") {
      console.log("verify-tap-payment: Payment not captured, status:", data.status);
      return new Response(
        JSON.stringify({ success: false, error: "Payment not captured", status: data.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Extract metadata
    const userId = data.metadata?.udf1;
    const planId = data.metadata?.udf2;

    if (!userId || !planId) {
      console.error("verify-tap-payment: Missing metadata in charge:", { userId, planId });
      return new Response(
        JSON.stringify({ success: false, error: "Missing payment metadata" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("verify-tap-payment: Creating subscription for:", { userId, planId, tap_id });

    // Create subscription if it doesn't exist
    const { data: result, error } = await supabase.rpc('create_subscription', {
      p_user_id: userId,
      p_plan_id: planId,
      p_tap_id: tap_id
    });

    if (error) {
      console.error("verify-tap-payment: Failed to create subscription:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("verify-tap-payment: Subscription result:", result);

    return new Response(JSON.stringify({ 
      success: true, 
      plan_id: planId,
      user_id: userId,
      message: "Payment verified and subscription created"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("verify-tap-payment: Internal error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
