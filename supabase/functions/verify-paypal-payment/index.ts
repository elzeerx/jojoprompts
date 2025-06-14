
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Accept order_id OR payment_id params
    const url = new URL(req.url);
    const orderId = url.searchParams.get("order_id") || url.searchParams.get("orderId");
    const paymentId = url.searchParams.get("payment_id") || url.searchParams.get("paymentId");

    if (!orderId && !paymentId) {
      return new Response(JSON.stringify({ error: "No order_id or payment_id supplied." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Find transaction in database, using PayPal order/payment id
    const { data, error } = await supabaseClient.from("transactions")
      .select("*")
      .or([
        orderId ? `paypal_order_id.eq.${orderId}` : '',
        paymentId ? `paypal_payment_id.eq.${paymentId}` : ''
      ].filter(Boolean).join(",")) // Compose query dynamically
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Transaction not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Return status to frontend
    return new Response(JSON.stringify({
      status: data.status?.toUpperCase() || "UNKNOWN",
      transaction: data
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
