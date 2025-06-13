
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

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

    let query = supabase
      .from('payments')
      .select('status, user_id, tap_charge_id, tap_reference');

    if (reference) {
      query = query.eq('tap_reference', reference);
    } else {
      query = query.eq('tap_charge_id', tap_id);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('Payment lookup error:', error);
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404
      });
    }

    console.log('Found payment record:', { 
      status: data.status, 
      userId: data.user_id,
      tapChargeId: data.tap_charge_id 
    });

    return new Response(JSON.stringify({ 
      status: data.status,
      user_id: data.user_id,
      tap_charge_id: data.tap_charge_id
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
