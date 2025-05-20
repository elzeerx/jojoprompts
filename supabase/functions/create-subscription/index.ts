
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

// Construct Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      },
      status: 204
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { "Content-Type": "application/json" },
      status: 405
    });
  }

  try {
    // Parse the request body
    const { userId, planId, paymentMethod, paymentId } = await req.json();

    // Basic validation
    if (!userId || !planId || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: "Invalid plan ID" }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Calculate end date for non-lifetime plans
    let endDate = null;
    if (!plan.is_lifetime && plan.duration_days) {
      const date = new Date();
      date.setDate(date.getDate() + plan.duration_days);
      endDate = date.toISOString();
    }

    // Create the subscription
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
      return new Response(
        JSON.stringify({ error: subscriptionError.message }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Create payment history record
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
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Subscription created successfully",
        subscription
      }),
      { 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }, 
        status: 500 
      }
    );
  }
});
