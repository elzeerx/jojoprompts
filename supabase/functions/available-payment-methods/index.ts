
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const availableMethods: string[] = [];

    // Check PayPal availability
    const paypalEnvironment = Deno.env.get('PAYPAL_ENVIRONMENT') || 'sandbox';
    const paypalClientIdKey = paypalEnvironment === 'production' 
      ? 'PAYPAL_LIVE_CLIENT_ID' 
      : 'PAYPAL_SANDBOX_CLIENT_ID';
    
    if (Deno.env.get(paypalClientIdKey)) {
      availableMethods.push('PayPal');
    }

    // Check Tap availability
    if (Deno.env.get('TAP_PUBLISHABLE_KEY') && Deno.env.get('TAP_SECRET_KEY')) {
      availableMethods.push('Tap');
    }

    return new Response(
      JSON.stringify({
        methods: availableMethods,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // 5 minutes cache
        }
      }
    );
  } catch (error) {
    console.error('Available payment methods error:', error);
    
    return new Response(
      JSON.stringify({
        methods: [],
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
