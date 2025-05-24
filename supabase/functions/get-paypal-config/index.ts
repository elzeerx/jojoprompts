
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get PayPal client ID from environment variables
    const sandboxClientId = Deno.env.get("PAYPAL_SANDBOX_CLIENT_ID");
    const liveClientId = Deno.env.get("PAYPAL_LIVE_CLIENT_ID");
    
    // Determine environment - default to sandbox for safety
    const isProduction = Deno.env.get("PAYPAL_ENVIRONMENT") === "production";
    
    const clientId = isProduction ? liveClientId : sandboxClientId;
    
    if (!clientId) {
      console.error("PayPal client ID not configured for environment:", isProduction ? "production" : "sandbox");
      return new Response(
        JSON.stringify({ 
          error: "PayPal configuration not found",
          environment: isProduction ? "production" : "sandbox"
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 500 
        }
      );
    }

    return new Response(
      JSON.stringify({
        clientId,
        environment: isProduction ? "production" : "sandbox",
        currency: "USD"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in get-paypal-config:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 500 
      }
    );
  }
});
