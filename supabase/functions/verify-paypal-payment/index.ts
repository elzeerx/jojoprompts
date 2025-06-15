
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

// Fetch PayPal config from Supabase secrets
function getPayPalConfig() {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID');
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
  const env = Deno.env.get('PAYPAL_ENVIRONMENT') || 'sandbox';
  const baseUrl = env === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
  return { clientId, clientSecret, baseUrl };
}

async function fetchPayPalAccessToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body: 'grant_type=client_credentials'
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Failed to get PayPal access token: ${data.error_description || res.statusText}`);
  }
  return data.access_token as string;
}

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

    // Fetch transaction from DB (for reference)
    let query = supabaseClient.from("transactions").select("*").order("created_at", { ascending: false }).limit(1);
    if (orderId && paymentId) {
      query = query.or(`paypal_order_id.eq.${orderId},paypal_payment_id.eq.${paymentId}`);
    } else if (orderId) {
      query = query.eq("paypal_order_id", orderId);
    } else if (paymentId) {
      query = query.eq("paypal_payment_id", paymentId);
    }
    let { data: localTx, error: txError } = await query.single();

    // === CRITICAL STEP: Call PayPal API to fetch real order/payment status ===

    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    let accessToken: string;
    try {
      accessToken = await fetchPayPalAccessToken(baseUrl, clientId, clientSecret);
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to get PayPal access token." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const orderIdToUse = orderId || localTx?.paypal_order_id;
    const paymentIdToUse = paymentId || localTx?.paypal_payment_id;

    let payPalStatus: string | null = null;
    let payPalRawResponse: any = null;

    if (orderIdToUse) {
      // Get PayPal order info
      const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderIdToUse}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const orderData = await orderRes.json();
      payPalRawResponse = orderData;

      // Order status: CREATED, APPROVED, COMPLETED, VOIDED, etc.
      payPalStatus = orderData.status || null;

      // If completed and has captures, get payment capture info
      if (payPalStatus === "COMPLETED" && orderData.purchase_units?.[0]?.payments?.captures?.[0]?.status) {
        payPalStatus = orderData.purchase_units[0].payments.captures[0].status;
      }
    } else if (paymentIdToUse) {
      // Lookup payment directly (most cases orderId is preferred)
      const paymentRes = await fetch(`${baseUrl}/v2/payments/captures/${paymentIdToUse}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const paymentData = await paymentRes.json();
      payPalRawResponse = paymentData;
      payPalStatus = paymentData.status || null;
    }

    if (!payPalStatus) {
      return new Response(JSON.stringify({ error: "Could not determine PayPal payment status.", paypal: payPalRawResponse }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // === Optionally update local DB if status changed ===
    if (localTx) {
      // Only update if local DB doesn't match PayPal
      if (localTx.status?.toUpperCase() !== payPalStatus.toUpperCase()) {
        await supabaseClient.from('transactions')
          .update({ status: payPalStatus.toLowerCase(), completed_at: new Date().toISOString() })
          .eq('id', localTx.id);
      }
    }

    // Return status to frontend (UPPERCASE for consistency)
    return new Response(JSON.stringify({
      status: payPalStatus.toUpperCase(),
      paypal: payPalRawResponse,
      transaction: localTx
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
