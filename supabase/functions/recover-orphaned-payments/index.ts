
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { makeSupabaseClient, findAndRecoverOrphanedTransactions } from "../verify-paypal-payment/dbOperations.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let userId: string | undefined;
  try {
    const { userId: bodyUserId } = await req.json();
    userId = bodyUserId;
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Missing or invalid userId in body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  if (!userId) {
    return new Response(JSON.stringify({ success: false, error: "userId required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const supabaseClient = makeSupabaseClient();
    const { recovered, errors } = await findAndRecoverOrphanedTransactions(supabaseClient, { user_id: userId });

    console.log(`[RECOVERY] Orphaned payments recovery for user ${userId}:`, { recovered, errors });

    return new Response(
      JSON.stringify({ success: true, recovered, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[RECOVERY] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
