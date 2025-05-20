
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

// Define your Tap API key (in production, this should be in secrets)
const TAP_API_KEY = "sk_test_XKokBfNWv6FIYuTMg5sLPjhJ"; // Replace with your actual test secret key

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
    const { planId, userId, amount, currency = "KWD" } = await req.json();

    // Basic validation
    if (!planId || !userId || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get the plan details
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

    // Create a Tap payment session
    const response = await fetch("https://api.tap.company/v2/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAP_API_KEY}`
      },
      body: JSON.stringify({
        amount,
        currency,
        customer: {
          id: userId,
          // In a real implementation, you would fetch user details
          // email, first_name, last_name, etc.
        },
        source: { id: "src_card" },
        redirect: {
          url: `${Deno.env.get("FRONTEND_URL") || "https://yourdomain.com"}/payment-success`
        },
        description: `JojoPrompts - ${plan.name} Plan`,
        metadata: {
          userId,
          planId
        }
      })
    });

    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
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
