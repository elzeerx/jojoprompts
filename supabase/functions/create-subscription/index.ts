
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
    // Verify Authorization header and JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Failed to verify JWT:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401
        }
      );
    }

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

    if (userId !== user.id) {
      console.error(`User ID mismatch: body ${userId} does not match token ${user.id}`);
      return new Response(
        JSON.stringify({ error: "User ID does not match authenticated user" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403
        }
      );
    }

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

    // CRITICAL: Enhanced payment verification
    const paymentMethod = paymentData.paymentMethod || 'unknown';
    const paymentId = paymentData.paymentId || paymentData.payment_id || null;
    const rawStatus = paymentData?.details?.status;
    const paymentStatus = typeof rawStatus === 'string' ? rawStatus.toUpperCase() : '';
    
    console.log("CRITICAL: Payment verification starting:", { 
      userId, 
      planId, 
      paymentMethod, 
      paymentId, 
      paymentStatus,
      hasVerifiedAt: !!paymentData?.details?.verified_at 
    });

    // STRICT payment verification - must be explicitly successful
    const acceptedStatuses = ['CAPTURED', 'PAID', 'AUTHORIZED'];
    if (!acceptedStatuses.includes(paymentStatus)) {
      console.error('CRITICAL: Payment status not acceptable for subscription creation:', {
        receivedStatus: paymentStatus,
        acceptedStatuses,
        paymentData
      });
      return new Response(
        JSON.stringify({
          error: 'Payment not verified as successful',
          status: paymentStatus || 'UNKNOWN',
          details: 'Subscription can only be created for successfully paid transactions'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Additional verification: check if payment was verified recently
    if (paymentData?.details?.verified_at) {
      const verifiedAt = new Date(paymentData.details.verified_at);
      const now = new Date();
      const timeDiff = now.getTime() - verifiedAt.getTime();
      const maxAge = 5 * 60 * 1000; // 5 minutes
      
      if (timeDiff > maxAge) {
        console.error('CRITICAL: Payment verification too old:', {
          verifiedAt: paymentData.details.verified_at,
          timeDiff,
          maxAge
        });
        return new Response(
          JSON.stringify({
            error: 'Payment verification expired',
            details: 'Payment verification is too old'
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    // Check for existing subscription to prevent duplicates
    console.log("Checking for existing active subscription...");
    const { data: existingSubscription, error: existingError } = await supabase
      .from("user_subscriptions")
      .select("id, payment_id, created_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing subscription:", existingError);
    } else if (existingSubscription) {
      console.log("Existing active subscription found:", existingSubscription);
      
      // Check if this is the same payment
      if (existingSubscription.payment_id === paymentId) {
        console.log("Subscription already exists for this payment, returning existing subscription");
        return new Response(
          JSON.stringify({
            success: true,
            message: "Subscription already exists for this payment",
            subscription: {
              id: existingSubscription.id,
              status: "active",
              existing: true
            }
          }),
          { 
            headers: { 
              ...corsHeaders,
              "Content-Type": "application/json"
            },
            status: 200
          }
        );
      }
    }

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

    // Verify payment amount matches plan price (if amount is available)
    if (paymentData?.details?.amount && plan.price_usd) {
      const amountDiff = Math.abs(paymentData.details.amount - plan.price_usd);
      if (amountDiff > 0.01) {
        console.error('CRITICAL: Payment amount does not match plan price:', {
          paymentAmount: paymentData.details.amount,
          planPrice: plan.price_usd,
          difference: amountDiff
        });
        return new Response(
          JSON.stringify({
            error: 'Payment amount verification failed',
            details: 'Payment amount does not match plan price'
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    // Calculate end date for non-lifetime plans
    let endDate = null;
    if (!plan.is_lifetime && plan.duration_days) {
      const date = new Date();
      date.setDate(date.getDate() + plan.duration_days);
      endDate = date.toISOString();
      console.log("Calculated end date:", endDate);
    }

    // Create the subscription
    console.log("CRITICAL: Creating verified subscription record...");
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

    console.log("CRITICAL: Subscription created successfully:", subscription.id);

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
        plan_name: plan.name,
        verified_payment: true
      }
    };

    console.log("CRITICAL: Returning verified subscription success:", successResponse);

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
    console.error("CRITICAL: Unexpected error in create-subscription:", error);
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
