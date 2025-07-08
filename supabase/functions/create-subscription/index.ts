
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase configuration");
}

const supabase = createClient(supabaseUrl!, supabaseServiceRoleKey!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planId, userId, paymentData } = await req.json();
    
    console.log("Creating subscription:", { planId, userId, paymentMethod: paymentData?.paymentMethod });

    if (!planId || !userId || !paymentData) {
      console.error("Missing required fields:", { planId: !!planId, userId: !!userId, paymentData: !!paymentData });
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.error("Plan not found:", planError);
      return new Response(
        JSON.stringify({ success: false, error: "Plan not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (existingSubscription) {
      console.log("User already has active subscription");
      return new Response(
        JSON.stringify({ success: false, error: "User already has an active subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Calculate end date
    let endDate = null;
    if (!plan.is_lifetime && plan.duration_days) {
      endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.duration_days);
    }

    // Create subscription record
    const { data: subscription, error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: userId,
        plan_id: planId,
        status: "active",
        start_date: new Date().toISOString(),
        end_date: endDate?.toISOString(),
        payment_method: paymentData.paymentMethod || 'paypal',
        payment_id: paymentData.details?.id || paymentData.paymentId
      })
      .select()
      .single();

    if (subscriptionError) {
      console.error("Failed to create subscription:", subscriptionError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Update user profile membership tier
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ membership_tier: "basic" })
      .eq("id", userId);

    if (profileError) {
      console.error("Failed to update user profile:", profileError);
    }

    // Create payment history record
    const { error: paymentHistoryError } = await supabase
      .from("payment_history")
      .insert({
        user_id: userId,
        subscription_id: subscription.id,
        amount_usd: plan.price_usd,
        payment_method: paymentData.paymentMethod || 'paypal',
        payment_id: paymentData.details?.id || paymentData.paymentId,
        status: "completed"
      });

    if (paymentHistoryError) {
      console.error("Failed to create payment history:", paymentHistoryError);
    }

    console.log("Subscription created successfully:", subscription.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        subscription: subscription,
        message: "Subscription created successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in create-subscription:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
