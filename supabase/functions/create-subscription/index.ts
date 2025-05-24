
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

// Construct Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
  "Access-Control-Max-Age": "86400",
};

serve(async (req: Request) => {
  console.log(`Received ${req.method} request to create-subscription`);

  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, {
      headers: corsHeaders,
      status: 200
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    console.log(`Method ${req.method} not allowed`);
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405
    });
  }

  try {
    // Parse the request body
    const requestBody = await req.text();
    console.log("Raw request body:", requestBody);

    let parsedBody;
    try {
      parsedBody = JSON.parse(requestBody);
    } catch (parseError) {
      console.error("Failed to parse JSON:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 400 
        }
      );
    }

    const { userId, planId, paymentData } = parsedBody;
    console.log("Parsed request data:", { userId, planId, paymentData: paymentData ? "present" : "missing" });

    // Basic validation
    if (!userId || !planId || !paymentData) {
      console.error("Missing required fields:", { userId: !!userId, planId: !!planId, paymentData: !!paymentData });
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields",
          details: {
            userId: !userId ? "missing" : "present",
            planId: !planId ? "missing" : "present", 
            paymentData: !paymentData ? "missing" : "present"
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Extract payment information from standardized data
    const paymentMethod = paymentData.paymentMethod || 'unknown';
    const paymentId = paymentData.paymentId || paymentData.payment_id || null;

    console.log("Processing subscription for:", { userId, planId, paymentMethod, paymentId });

    // Get plan details
    console.log("Fetching plan details...");
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.error("Plan error:", planError);
      return new Response(
        JSON.stringify({ error: "Invalid plan ID", details: planError?.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("Plan found:", { planName: plan.name, price: plan.price_usd, isLifetime: plan.is_lifetime });

    // Calculate end date for non-lifetime plans
    let endDate = null;
    if (!plan.is_lifetime && plan.duration_days) {
      const date = new Date();
      date.setDate(date.getDate() + plan.duration_days);
      endDate = date.toISOString();
      console.log("Calculated end date:", endDate);
    }

    // Create the subscription
    console.log("Creating subscription record...");
    const { data: subscription, error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: userId,
        plan_id: planId,
        payment_method: paymentMethod,
        payment_id: paymentId,
        end_date: endDate,
        status: "active"
      })
      .select()
      .single();

    if (subscriptionError) {
      console.error("Subscription creation error:", subscriptionError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to create subscription",
          details: subscriptionError.message 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log("Subscription created successfully:", subscription.id);

    // Create payment history record
    console.log("Creating payment history record...");
    const { error: paymentError } = await supabase
      .from("payment_history")
      .insert({
        user_id: userId,
        subscription_id: subscription.id,
        amount_usd: plan.price_usd,
        amount_kwd: plan.price_kwd,
        payment_method: paymentMethod,
        payment_id: paymentId,
        status: "completed"
      });

    if (paymentError) {
      console.error("Payment history error:", paymentError);
      // We don't fail the whole transaction for this, just log it
    } else {
      console.log("Payment history created successfully");
    }

    const successResponse = {
      success: true,
      message: "Subscription created successfully",
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan_name: plan.name
      }
    };

    console.log("Returning success response:", successResponse);

    return new Response(
      JSON.stringify(successResponse),
      { 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      }
    );
  } catch (error) {
    console.error("Unexpected error in create-subscription:", error);
    console.error("Error stack:", error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message || "Unknown error occurred",
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json"
        }, 
        status: 500 
      }
    );
  }
});
