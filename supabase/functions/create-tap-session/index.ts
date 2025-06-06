
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
    console.log("Processing Tap configuration request for USD");
    
    const body = await req.json().catch(() => ({}));
    const { amount, planName, currency = "USD" } = body;

    console.log("Request body:", { amount, planName, currency });

    if (!amount || !planName) {
      console.error("Missing required fields");
      return new Response(JSON.stringify({ 
        error: "Missing required fields",
        message: "Amount and plan name are required"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const tapPublishableKey = Deno.env.get("TAP_PUBLISHABLE_KEY");
    
    if (!tapPublishableKey) {
      console.error("TAP_PUBLISHABLE_KEY not configured");
      return new Response(JSON.stringify({ 
        error: "Payment service not configured",
        message: "Tap payment configuration is missing. Please contact support."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503
      });
    }

    // Validate amount
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error("Invalid amount:", amount);
      return new Response(JSON.stringify({ 
        error: "Invalid amount",
        message: "Amount must be a positive number"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const config = {
      publishableKey: tapPublishableKey,
      amount: numericAmount,
      currency: "USD",
      planName: planName
    };

    console.log("Returning Tap configuration for USD:", { 
      amount: config.amount, 
      currency: config.currency,
      planName: config.planName 
    });
    
    return new Response(JSON.stringify(config), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in create-tap-session:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error.message,
      message: "Failed to create Tap payment session. Please try again."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
