
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
    const { orderId } = await req.json().catch(() => ({}));
    const { PAYPAL_CLIENT_ID, PAYPAL_SECRET } = Deno.env.toObject();

    console.log("Capturing PayPal order:", orderId);

    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
      console.error("PayPal credentials not configured");
      return new Response(JSON.stringify({ error: "PayPal credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!orderId) {
      return new Response(JSON.stringify({ error: "Order ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Capture the payment
    const response = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)}`,
      },
    });

    const data = await response.json();
    console.log("PayPal capture response:", data);
    
    if (!response.ok) {
      console.error("PayPal capture failed:", data);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `PayPal capture failed: ${data.message || 'Unknown error'}` 
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if capture was successful
    const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const captureStatus = data.purchase_units?.[0]?.payments?.captures?.[0]?.status;

    if (captureStatus === "COMPLETED" && captureId) {
      return new Response(JSON.stringify({ 
        success: true, 
        captureId,
        orderId,
        status: captureStatus 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      console.error("Payment capture not completed:", data);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Payment capture was not completed" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("PayPal capture order error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Failed to capture PayPal payment" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
