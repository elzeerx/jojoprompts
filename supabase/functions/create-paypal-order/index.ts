
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_ENVIRONMENT = Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://preview--jojoprompts.lovable.app";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
};

// Get PayPal API base URL based on environment
function getPayPalApiUrl(): string {
  return PAYPAL_ENVIRONMENT === 'production' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
}

// Enhanced PayPal access token function with better error handling
async function getPayPalAccessToken(): Promise<string> {
  console.log('=== PayPal Authentication Debug ===');
  console.log('Environment:', PAYPAL_ENVIRONMENT);
  console.log('API URL:', getPayPalApiUrl());
  console.log('Client ID provided:', !!PAYPAL_CLIENT_ID);
  console.log('Client Secret provided:', !!PAYPAL_CLIENT_SECRET);
  
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    const missingCredentials = [];
    if (!PAYPAL_CLIENT_ID) missingCredentials.push('PAYPAL_CLIENT_ID');
    if (!PAYPAL_CLIENT_SECRET) missingCredentials.push('PAYPAL_CLIENT_SECRET');
    throw new Error(`Missing PayPal credentials: ${missingCredentials.join(', ')}`);
  }

  // Log credential format (safely)
  console.log('Client ID format check:', {
    length: PAYPAL_CLIENT_ID.length,
    startsWithA: PAYPAL_CLIENT_ID.startsWith('A'),
    hasCorrectStructure: /^A[A-Za-z0-9_-]+$/.test(PAYPAL_CLIENT_ID)
  });

  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  console.log('Authorization header created successfully');
  
  try {
    const response = await fetch(`${getPayPalApiUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: 'grant_type=client_credentials'
    });

    console.log('PayPal auth response status:', response.status);
    console.log('PayPal auth response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('PayPal authentication failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });

      // Parse error response if it's JSON
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
        console.error('Parsed error details:', errorDetails);
      } catch (e) {
        console.error('Error response is not JSON:', errorText);
      }

      throw new Error(`PayPal authentication failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('PayPal access token obtained successfully');
    return data.access_token;
  } catch (error) {
    console.error('Error in PayPal authentication:', error);
    throw error;
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
    console.log('=== Create PayPal Order Request ===');
    console.log('Timestamp:', new Date().toISOString());

    const { planId, userId, amount } = await req.json();
    console.log('Request payload:', { planId, userId, amount });

    if (!planId || !userId || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields: planId, userId, amount" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Verify plan exists
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.error("Plan validation error:", planError);
      return new Response(JSON.stringify({ error: "Invalid plan selected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Get user profile
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      console.error("User validation error:", userError);
      return new Response(JSON.stringify({ error: "Invalid user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    console.log("=== Starting PayPal Order Creation ===");

    // Get PayPal access token with enhanced error handling
    const accessToken = await getPayPalAccessToken();

    // Create PayPal order
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: "USD",
          value: amount.toString()
        },
        description: `${plan.name} - JojoPrompts Subscription`,
        custom_id: `${userId}_${planId}`,
        invoice_id: `jojo_${planId}_${userId}_${Date.now()}`
      }],
      application_context: {
        return_url: `${FRONTEND_URL}/payment-callback?success=true&plan_id=${planId}&user_id=${userId}`,
        cancel_url: `${FRONTEND_URL}/payment-callback?success=false&plan_id=${planId}&user_id=${userId}`,
        brand_name: "JojoPrompts",
        user_action: "PAY_NOW"
      }
    };

    console.log('PayPal order payload:', JSON.stringify(orderPayload, null, 2));

    const paypalResponse = await fetch(`${getPayPalApiUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    console.log('PayPal order creation response status:', paypalResponse.status);

    if (!paypalResponse.ok) {
      const errorText = await paypalResponse.text();
      console.error("PayPal order creation failed:", { 
        status: paypalResponse.status, 
        statusText: paypalResponse.statusText,
        error: errorText 
      });
      return new Response(JSON.stringify({ error: "Payment gateway error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502
      });
    }

    const paypalData = await paypalResponse.json();
    console.log("PayPal order created successfully:", { id: paypalData.id, status: paypalData.status });

    // Save payment record
    const { error: insertError } = await supabase.from('payments').insert({
      user_id: userId,
      paypal_order_id: paypalData.id,
      amount: Math.round(amount * 100), // Convert to cents
      status: paypalData.status,
      currency: 'USD'
    });

    if (insertError) {
      console.error("Failed to save payment record:", insertError);
    }

    // Find approval URL
    const approvalUrl = paypalData.links?.find(link => link.rel === 'approve')?.href;
    console.log("PayPal order approval URL:", approvalUrl);

    return new Response(JSON.stringify({ 
      id: paypalData.id,
      status: paypalData.status,
      url: approvalUrl
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("=== Payment Creation Error ===");
    console.error("Error details:", error);
    console.error("Error stack:", error.stack);
    
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
