
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// For logging and debugging
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PAYPAL signature verification is recommended, but this example logs and processes payment events 
// You can extend this with full signature validation and event filtering as needed

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  const logger = (...args: any[]) => console.log(`[PAYPAL-WEBHOOK][${requestId}]`, ...args);
  let payload: any;
  try {
    payload = await req.json();
  } catch (e) {
    logger("Failed to parse webhook body", e);
    return new Response("Invalid payload", { status: 400, headers: corsHeaders });
  }

  logger("Webhook received:", JSON.stringify(payload));

  // You can check the event type and resource structure for payments here
  if (!payload?.resource) {
    logger("No resource found in event.");
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  // Extract the PayPal payment/order info (customize based on your PayPal events)
  const paymentId = payload.resource.id;
  const status = payload.resource.status; // Should be "COMPLETED" on successful payment
  let userId, planId;

  // Optionally extract custom_id or invoice_number from purchase_units for user mapping
  // (Assumes you tagged these fields when creating the order)
  if (payload.resource.purchase_units && payload.resource.purchase_units[0]) {
    const pu = payload.resource.purchase_units[0];
    userId = pu.custom_id || pu.reference_id || null;
    planId = pu.invoice_number || null; // You may need to adapt this depending on what you populate when creating the order
  }

  // Only proceed for COMPLETED or approved payment events
  if (status && ["COMPLETED", "APPROVED"].includes(status)) {
    // Update the transactions table: find row by payment_id (or fallback to order_id) and mark as completed
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    // Find the transaction matching this payment/order/user
    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .or(`paypal_payment_id.eq.${paymentId},paypal_order_id.eq.${paymentId}`)
      .maybeSingle();
    if (tx) {
      // Update to completed if not already
      if (tx.status !== "completed") {
        logger("Updating transaction to completed:", paymentId);
        await supabase
          .from("transactions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", tx.id);
      }
      // Ensure subscription exists if not already created
      const { data: sub } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("payment_id", paymentId)
        .maybeSingle();
      if (!sub && tx.user_id && tx.plan_id) {
        logger("Inserting subscription for:", tx.user_id, tx.plan_id);
        await supabase
          .from("user_subscriptions")
          .insert({
            user_id: tx.user_id,
            plan_id: tx.plan_id,
            payment_method: "paypal",
            payment_id: paymentId,
            status: "active",
            start_date: new Date().toISOString(),
            transaction_id: tx.id,
          });
      }
    } else {
      logger("No local transaction found for payment_id", paymentId);
    }
    logger("Payment event processed", paymentId, status);
  }

  return new Response("Webhook handled", { status: 200, headers: corsHeaders });
});
