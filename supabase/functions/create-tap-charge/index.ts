
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const TAP_SECRET_KEY = Deno.env.get("TAP_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
};

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
    if (!TAP_SECRET_KEY) {
      console.error("TAP_SECRET_KEY not configured");
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503
      });
    }

    const { user_id, amount } = await req.json();

    if (!user_id || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields: user_id, amount" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Get origin from request headers for redirect URL
    const origin = req.headers.get('origin') || 'https://jojoprompts.lovable.app';

    const body = {
      amount,
      currency: 'USD',
      threeDSecure: true,
      customer_initiated: true,
      description: 'JojoPrompts Basic Plan',
      reference: { transaction: crypto.randomUUID() },
      redirect: { url: `${origin}/payment/callback` },
      source: { id: 'src_all' } // card & local wallets
    };

    console.log("Creating Tap charge:", { amount, user_id, redirect_url: body.redirect.url });

    const tapRes = await fetch('https://api.tap.company/v2/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TAP_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!tapRes.ok) {
      const errorText = await tapRes.text();
      console.error("Tap API error:", { status: tapRes.status, error: errorText });
      return new Response(JSON.stringify({ error: "Payment gateway error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502
      });
    }

    const tapData = await tapRes.json();
    console.log("Tap charge created:", { id: tapData.id, status: tapData.status });

    // Save INITIATED payment row
    const { error: insertError } = await supabase.from('payments').insert({
      user_id,
      tap_charge_id: tapData.id,
      tap_reference: tapData.reference?.transaction,
      amount,
      status: tapData.status // INITIATED
    });

    if (insertError) {
      console.error("Failed to save payment record:", insertError);
      // Continue anyway - the charge was created successfully
    }

    return new Response(JSON.stringify({ 
      url: tapData.transaction?.url || tapData.redirect?.url 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("Payment creation error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
