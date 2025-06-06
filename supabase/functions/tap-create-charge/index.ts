
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { amount = 9.99 } = await req.json().catch(() => ({})); // Default $9.99 USD
    const tapSk = Deno.env.get("TAP_SK");

    console.log("Creating Tap charge for amount:", amount, "USD");

    if (!tapSk) {
      console.error("Tap secret key not configured");
      return new Response(JSON.stringify({ error: "Tap secret key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chargePayload = {
      amount,
      currency: "USD",
      threeDSecure: true,
      description: "JojoPrompts access",
      source: { id: "src_all" },
      redirect: { url: "https://jojoprompts.lovable.app/payment-success" },
    };

    console.log("Sending request to Tap API with payload:", chargePayload);

    const response = await fetch("https://api.tap.company/v2/charges", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tapSk}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chargePayload),
    });

    const data = await response.text();
    console.log("Tap API response status:", response.status);
    console.log("Tap API response data:", data);
    
    return new Response(data, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Tap create charge error:", error);
    return new Response(JSON.stringify({ error: "Failed to create Tap charge" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
