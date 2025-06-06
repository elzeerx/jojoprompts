
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const TAP_SECRET_KEY = Deno.env.get("TAP_SECRET_KEY");
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://jojoprompts.lovable.app";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
};

function sanitizeInput(input: any): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>]/g, '').trim();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ 
      error: "Method not allowed" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405
    });
  }

  try {
    if (!TAP_SECRET_KEY) {
      console.error("TAP_SECRET_KEY not configured");
      return new Response(JSON.stringify({ 
        error: "Payment service not configured" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503
      });
    }

    const body = await req.json().catch(() => null);
    
    if (!body) {
      return new Response(JSON.stringify({ 
        error: "Invalid request body" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const { planId, userId, amount, currency = "USD" } = body;

    if (!planId || !userId || !amount) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields: planId, userId, amount" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Validate amount
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0 || numericAmount > 10000) {
      return new Response(JSON.stringify({ 
        error: "Invalid amount" 
      }), {
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
      return new Response(JSON.stringify({ 
        error: "Invalid plan" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      console.error("User validation error:", userError);
      return new Response(JSON.stringify({ 
        error: "Invalid user" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Create Tap charge with correct payload structure
    const tapPayload = {
      amount: numericAmount,
      currency: currency.toUpperCase(),
      threeDSecure: true,
      save_card: false,
      description: `JojoPrompts - ${sanitizeInput(plan.name)} Plan`,
      statement_descriptor: "JojoPrompts",
      metadata: {
        udf1: sanitizeInput(userId),
        udf2: sanitizeInput(planId),
        udf3: new Date().toISOString()
      },
      reference: {
        transaction: `jojo_${planId}_${userId}_${Date.now()}`,
        order: `order_${Date.now()}`
      },
      receipt: {
        email: false,
        sms: false
      },
      customer: {
        first_name: sanitizeInput(user.first_name || "User"),
        last_name: sanitizeInput(user.last_name || ""),
        email: "",
        phone: {
          country_code: "",
          number: ""
        }
      },
      source: {
        id: "src_all"
      },
      post: {
        url: `${FRONTEND_URL}/payment-success?planId=${planId}&userId=${userId}`
      },
      redirect: {
        url: `${FRONTEND_URL}/payment-success?planId=${planId}&userId=${userId}`
      }
    };

    console.log("Creating Tap charge:", { 
      amount: tapPayload.amount, 
      currency: tapPayload.currency,
      planName: plan.name,
      reference: tapPayload.reference.transaction
    });

    const response = await fetch("https://api.tap.company/v2/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAP_SECRET_KEY}`
      },
      body: JSON.stringify(tapPayload)
    });

    const responseText = await response.text();
    console.log("Tap API raw response:", responseText);

    if (!response.ok) {
      console.error("Tap API error:", response.status, response.statusText, responseText);
      return new Response(JSON.stringify({ 
        error: "Payment gateway error",
        details: responseText
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Tap response:", parseError);
      return new Response(JSON.stringify({ 
        error: "Invalid response from payment gateway" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502
      });
    }
    
    console.log("Tap charge created successfully:", { 
      id: data.id, 
      status: data.status,
      transaction_url: data.transaction?.url
    });
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Payment creation error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error" 
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }, 
      status: 500 
    });
  }
});
