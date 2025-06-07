import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const { chargeId } = await req.json();

    if (!chargeId) {
      return new Response(
        JSON.stringify({ error: "Missing chargeId" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const tapKey = Deno.env.get("TAP_SECRET_KEY");
    if (!tapKey) {
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
      );
    }

    const response = await fetch(`https://api.tap.company/v2/charges/${encodeURIComponent(chargeId)}`, {
      headers: {
        "Authorization": `Bearer ${tapKey}`,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch charge", details: text }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: response.status }
      );
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      return new Response(
        JSON.stringify({ error: "Invalid response from payment gateway" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
