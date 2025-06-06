
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req: Request) => {
  console.log(`Request method: ${req.method}`);
  
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
    console.log("Processing Tap configuration request");
    
    const body = await req.json().catch(() => ({}));
    const { amount, planName, currency = "KWD" } = body;

    console.log("Request body:", { amount, planName, currency });

    if (!amount || !planName) {
      console.error("Missing required fields");
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const tapPublishableKey = Deno.env.get("TAP_PUBLISHABLE_KEY");
    
    if (!tapPublishableKey) {
      console.error("TAP_PUBLISHABLE_KEY not configured");
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503
      });
    }

    const config = {
      publishableKey: tapPublishableKey,
      amount: parseFloat(amount),
      currency,
      planName
    };

    console.log("Returning Tap configuration");
    
    return new Response(JSON.stringify(config), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in create-tap-session:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
