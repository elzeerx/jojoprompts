
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_ENVIRONMENT = Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
};

function getPayPalApiUrl(): string {
  return PAYPAL_ENVIRONMENT === 'production' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken(): Promise<string> {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  
  const response = await fetch(`${getPayPalApiUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get('order_id');
    const paymentId = url.searchParams.get('payment_id');

    console.log('Verify PayPal payment request:', { orderId, paymentId });

    if (!orderId && !paymentId) {
      return new Response(JSON.stringify({ error: "Missing order_id or payment_id parameter" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      console.error("PayPal credentials not configured");
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503
      });
    }

    // Get payment record from database
    let query = supabase
      .from('payments')
      .select('id, status, user_id, paypal_order_id, paypal_payment_id');

    if (orderId) {
      query = query.eq('paypal_order_id', orderId);
    } else {
      query = query.eq('paypal_payment_id', paymentId);
    }

    const { data: paymentRecord, error: dbError } = await query.single();

    if (dbError) {
      console.error('Payment lookup error:', dbError);
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404
      });
    }

    const orderIdToCheck = paymentRecord.paypal_order_id || orderId;
    
    console.log('Found payment record, fetching status from PayPal API:', { 
      orderIdToCheck,
      currentStatus: paymentRecord.status 
    });

    // Get PayPal access token and check order status
    const accessToken = await getPayPalAccessToken();
    
    const paypalResponse = await fetch(`${getPayPalApiUrl()}/v2/checkout/orders/${orderIdToCheck}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!paypalResponse.ok) {
      console.error('PayPal API error:', { status: paypalResponse.status });
      return new Response(JSON.stringify({ 
        status: paymentRecord.status,
        user_id: paymentRecord.user_id,
        paypal_order_id: paymentRecord.paypal_order_id,
        source: 'database_fallback'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    const paypalData = await paypalResponse.json();
    console.log('PayPal API response:', { 
      id: paypalData.id, 
      status: paypalData.status,
      previousStatus: paymentRecord.status 
    });

    // Update database with latest status
    if (paypalData.status && paypalData.status !== paymentRecord.status) {
      console.log('Updating payment status:', { 
        from: paymentRecord.status, 
        to: paypalData.status 
      });

      const updateData: any = { status: paypalData.status };

      // If payment is completed, extract payer information
      if (paypalData.status === 'COMPLETED' && paypalData.payer?.payer_id) {
        updateData.paypal_payer_id = paypalData.payer.payer_id;
      }

      // If there are purchase units with payments, get payment ID
      if (paypalData.purchase_units?.[0]?.payments?.captures?.[0]?.id) {
        updateData.paypal_payment_id = paypalData.purchase_units[0].payments.captures[0].id;
      }
      
      const { error: updateError } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentRecord.id);

      if (updateError) {
        console.error('Failed to update payment status:', updateError);
      }

      // If payment is completed, upgrade user profile
      if (paypalData.status === 'COMPLETED') {
        console.log('Payment completed, upgrading user profile:', paymentRecord.user_id);
        
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ membership_tier: 'basic' })
          .eq('id', paymentRecord.user_id);

        if (profileError) {
          console.error('Failed to upgrade user profile:', profileError);
        }
      }
    }

    return new Response(JSON.stringify({ 
      status: paypalData.status || paymentRecord.status,
      user_id: paymentRecord.user_id,
      paypal_order_id: paymentRecord.paypal_order_id,
      paypal_payment_id: paymentRecord.paypal_payment_id,
      source: 'paypal_api'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("Verify payment error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
