
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

    // Improved: Build query correctly whether one or both ids are present
    let query = supabaseClient.from("transactions").select("*").order("created_at", { ascending: false }).limit(1);
    if (orderId && paymentId) {
      query = query.or(`paypal_order_id.eq.${orderId},paypal_payment_id.eq.${paymentId}`);
    } else if (orderId) {
      query = query.eq("paypal_order_id", orderId);
    } else if (paymentId) {
      query = query.eq("paypal_payment_id", paymentId);
    }

    let { data, error } = await query.single();

    if (error || !data) {
      console.error("verify-paypal-payment ERROR: ", error, { orderId, paymentId });
      return new Response(JSON.stringify({ error: "Transaction not found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Return status to frontend (UPPERCASE for consistency)
    return new Response(JSON.stringify({
      status: (data.status || "UNKNOWN").toUpperCase(),
      transaction: data
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("verify-paypal-payment FATAL: ", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
