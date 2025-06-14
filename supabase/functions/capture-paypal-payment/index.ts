
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_ENVIRONMENT = Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
};

function getPayPalApiUrl(): string {
  return PAYPAL_ENVIRONMENT === 'production' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken(): Promise<string> {
  console.log('=== Getting PayPal Access Token ===');
  
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured');
  }

  const credentials = `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`;
  const encodedCredentials = btoa(credentials);
  
  const response = await fetch(`${getPayPalApiUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${encodedCredentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('PayPal authentication failed:', errorText);
    throw new Error(`PayPal authentication failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('PayPal access token obtained successfully');
  return data.access_token;
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
    console.log('=== Capture PayPal Payment Request ===');
    console.log('Timestamp:', new Date().toISOString());

    const { orderId, planId, userId } = await req.json();
    console.log('Request payload:', { orderId, planId, userId });

    if (!orderId || !planId || !userId) {
      return new Response(JSON.stringify({ error: "Missing required fields: orderId, planId, userId" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Capture the PayPal order
    console.log('=== Capturing PayPal Order ===');
    console.log('Order ID:', orderId);
    
    const captureResponse = await fetch(`${getPayPalApiUrl()}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('PayPal capture response status:', captureResponse.status);

    if (!captureResponse.ok) {
      const errorText = await captureResponse.text();
      console.error("PayPal capture failed:", { 
        status: captureResponse.status, 
        error: errorText 
      });
      return new Response(JSON.stringify({ 
        error: "Payment capture failed",
        details: `PayPal capture error: ${captureResponse.status}`,
        success: false
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502
      });
    }

    const captureData = await captureResponse.json();
    console.log("=== PayPal Capture Success ===");
    console.log("Capture ID:", captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id);
    console.log("Status:", captureData.status);

    // Extract payment information
    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const paymentStatus = captureData.status;
    const payerEmail = captureData.payer?.email_address;
    const payerId = captureData.payer?.payer_id;

    // Update payment record
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: paymentStatus,
        paypal_payment_id: captureId,
        paypal_payer_id: payerId,
        updated_at: new Date().toISOString()
      })
      .eq('paypal_order_id', orderId);

    if (updateError) {
      console.error("Failed to update payment record:", updateError);
    } else {
      console.log("Payment record updated successfully");
    }

    // If payment is completed, create subscription
    if (paymentStatus === 'COMPLETED') {
      console.log('=== Creating User Subscription ===');
      console.log('User ID:', userId, 'Plan ID:', planId);
      
      // Get plan details
      const { data: plan, error: planError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        console.error("Plan not found:", planError);
        return new Response(JSON.stringify({ 
          error: "Plan not found",
          success: false
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        });
      }

      console.log("Plan found:", plan.name);

      // Create user subscription
      const expiresAt = plan.is_lifetime ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      
      const { error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: expiresAt?.toISOString(),
          payment_method: 'paypal',
          payment_id: captureId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (subscriptionError) {
        console.error("Failed to create subscription:", subscriptionError);
        return new Response(JSON.stringify({ 
          error: "Subscription creation failed",
          success: false
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        });
      }

      console.log("Subscription created successfully");

      // Update user profile
      const membershipTier = plan.is_lifetime ? 'lifetime' : 'premium';
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          membership_tier: membershipTier,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (profileError) {
        console.error("Failed to update user profile:", profileError);
      } else {
        console.log("User profile updated to:", membershipTier);
      }

      console.log('=== Subscription Setup Complete ===');
    }

    console.log('=== Payment Capture Complete ===');
    
    return new Response(JSON.stringify({ 
      success: true,
      status: paymentStatus,
      captureId: captureId,
      orderId: orderId,
      payerEmail: payerEmail
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("=== Payment Capture Error ===");
    console.error("Error details:", error);
    console.error("Error stack:", error.stack);
    
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error.message,
      success: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
