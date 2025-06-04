
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
    console.log("Fetching PayPal configuration from environment variables");
    
    // Get PayPal client ID from environment variables
    const sandboxClientId = Deno.env.get("PAYPAL_SANDBOX_CLIENT_ID");
    const liveClientId = Deno.env.get("PAYPAL_LIVE_CLIENT_ID");
    const environment = Deno.env.get("PAYPAL_ENVIRONMENT")?.toLowerCase()?.trim();
    
    console.log("Environment configuration:", { 
      environment,
      hasSandboxKey: !!sandboxClientId,
      hasLiveKey: !!liveClientId 
    });
    
    // Determine environment - default to sandbox for safety
    const isProduction = environment === "production";
    
    const clientId = isProduction ? liveClientId : sandboxClientId;
    
    if (!clientId) {
      console.error("PayPal client ID not configured for environment:", isProduction ? "production" : "sandbox");
      return new Response(
        JSON.stringify({ 
          error: "PayPal configuration not found",
          environment: isProduction ? "production" : "sandbox",
          details: isProduction ? "Live client ID missing" : "Sandbox client ID missing"
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 500 
        }
      );
    }

    const config = {
      clientId,
      environment: isProduction ? "production" : "sandbox",
      currency: "USD"
    };

    console.log("PayPal configuration successful:", { environment: config.environment });

    return new Response(
      JSON.stringify(config),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error in get-paypal-config:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 500 
      }
    );
  }
});
