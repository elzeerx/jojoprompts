
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const TAP_SECRET_KEY = Deno.env.get("TAP_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405
    });
  }

  try {
    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');
    const tap_id = url.searchParams.get('tap_id');

    console.log('Verify payment request:', { reference, tap_id });

    if (!reference && !tap_id) {
      return new Response(JSON.stringify({ error: "Missing reference or tap_id parameter" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    if (!TAP_SECRET_KEY) {
      console.error("TAP_SECRET_KEY not configured");
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503
      });
    }

    // First, get the payment record from our database
    let query = supabase
      .from('payments')
      .select('id, status, user_id, tap_charge_id, tap_reference');

    if (reference) {
      query = query.eq('tap_reference', reference);
    } else {
      query = query.eq('tap_charge_id', tap_id);
    }

    const { data: paymentRecord, error: dbError } = await query.single();

    if (dbError) {
      console.error('Payment lookup error:', dbError);
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404
      });
    }

    const chargeId = paymentRecord.tap_charge_id || tap_id;
    
    console.log('Found payment record, fetching status from Tap API:', { 
      chargeId,
      currentStatus: paymentRecord.status 
    });

    // Call Tap API to get real-time status
    const tapResponse = await fetch(`https://api.tap.company/v2/charges/${chargeId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TAP_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!tapResponse.ok) {
      console.error('Tap API error:', { status: tapResponse.status });
      // Fall back to database status if Tap API fails
      return new Response(JSON.stringify({ 
        status: paymentRecord.status,
        user_id: paymentRecord.user_id,
        tap_charge_id: paymentRecord.tap_charge_id,
        source: 'database_fallback'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    const tapData = await tapResponse.json();
    console.log('Tap API response:', { 
      id: tapData.id, 
      status: tapData.status,
      previousStatus: paymentRecord.status 
    });

    // Update our database with the latest status from Tap
    if (tapData.status && tapData.status !== paymentRecord.status) {
      console.log('Updating payment status:', { 
        from: paymentRecord.status, 
        to: tapData.status 
      });
      
      const { error: updateError } = await supabase
        .from('payments')
        .update({ status: tapData.status })
        .eq('id', paymentRecord.id);

      if (updateError) {
        console.error('Failed to update payment status:', updateError);
      }

      // If payment is captured, upgrade user profile
      if (tapData.status === 'CAPTURED') {
        console.log('Payment captured, upgrading user profile:', paymentRecord.user_id);
        
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
      status: tapData.status || paymentRecord.status,
      user_id: paymentRecord.user_id,
      tap_charge_id: paymentRecord.tap_charge_id,
      source: 'tap_api'
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
