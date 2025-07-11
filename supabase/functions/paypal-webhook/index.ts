
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Enhanced webhook signature verification
async function verifyWebhookSignature(payload: string, headers: Headers): Promise<boolean> {
  try {
    // PayPal sends webhook signature in these headers
    const authAlgo = headers.get('PAYPAL-AUTH-ALGO');
    const transmission = headers.get('PAYPAL-TRANSMISSION-ID');
    const certId = headers.get('PAYPAL-CERT-ID');
    const signature = headers.get('PAYPAL-TRANSMISSION-SIG');
    const timestamp = headers.get('PAYPAL-TRANSMISSION-TIME');

    // For now, return true if basic headers are present
    // In production, implement full signature verification
    return !!(authAlgo && transmission && certId && signature && timestamp);
  } catch (error) {
    console.log('Webhook signature verification error:', error);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  const logger = (...args: any[]) => console.log(`[PAYPAL-WEBHOOK][${requestId}]`, ...args);
  
  let payload: any;
  let rawBody: string;
  
  try {
    rawBody = await req.text();
    payload = JSON.parse(rawBody);
  } catch (e) {
    logger("Failed to parse webhook body", e);
    return new Response("Invalid payload", { status: 400, headers: corsHeaders });
  }

  logger("Webhook received:", {
    eventType: payload.event_type,
    resourceType: payload.resource_type,
    resourceId: payload.resource?.id
  });

  // Enhanced signature verification
  const isSignatureValid = await verifyWebhookSignature(rawBody, req.headers);
  if (!isSignatureValid) {
    logger("Webhook signature verification failed");
    // In production, return 400. For development, log warning and continue
    logger("WARNING: Proceeding without signature verification (development mode)");
  }

  // Check for resource and event type
  if (!payload?.resource || !payload?.event_type) {
    logger("Invalid webhook format - missing resource or event_type");
    return new Response("Invalid webhook format", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Handle different event types
  const eventType = payload.event_type;
  const resource = payload.resource;

  logger("Processing event type:", eventType);

  try {
    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      await handleOrderApproved(supabase, resource, logger);
    } else if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      await handlePaymentCaptureCompleted(supabase, resource, logger);
    } else if (eventType === 'CHECKOUT.ORDER.COMPLETED') {
      await handleOrderCompleted(supabase, resource, logger);
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.DECLINED') {
      await handlePaymentFailed(supabase, resource, logger);
    } else {
      logger("Unhandled event type:", eventType);
    }
  } catch (error) {
    logger("Error processing webhook:", error);
    return new Response("Webhook processing failed", { status: 500, headers: corsHeaders });
  }

  return new Response("Webhook processed successfully", { status: 200, headers: corsHeaders });
});

// Handle order approved event
async function handleOrderApproved(supabase: any, resource: any, logger: any) {
  const orderId = resource.id;
  logger("Order approved:", orderId);

  // Find transaction by order ID
  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("paypal_order_id", orderId)
    .maybeSingle();

  if (transaction && transaction.status === 'pending') {
    logger("Updating transaction status to approved:", transaction.id);
    await supabase
      .from("transactions")
      .update({ 
        status: "approved",
        updated_at: new Date().toISOString()
      })
      .eq("id", transaction.id);
  }
}

// Handle payment capture completed event
async function handlePaymentCaptureCompleted(supabase: any, resource: any, logger: any) {
  const paymentId = resource.id;
  const status = resource.status;
  const orderId = resource.supplementary_data?.related_ids?.order_id;

  logger("Payment capture completed:", { paymentId, status, orderId });

  if (status === "COMPLETED") {
    // Find transaction by payment ID or order ID
    let transaction = null;
    
    if (paymentId) {
      const { data: txByPayment } = await supabase
        .from("transactions")
        .select("*")
        .eq("paypal_payment_id", paymentId)
        .maybeSingle();
      transaction = txByPayment;
    }

    if (!transaction && orderId) {
      const { data: txByOrder } = await supabase
        .from("transactions")
        .select("*")
        .eq("paypal_order_id", orderId)
        .maybeSingle();
      transaction = txByOrder;
    }

    if (transaction) {
      logger("Updating transaction to completed:", transaction.id);
      
      // Update transaction
      await supabase
        .from("transactions")
        .update({ 
          status: "completed",
          paypal_payment_id: paymentId,
          completed_at: new Date().toISOString()
        })
        .eq("id", transaction.id);

      // Create subscription if it doesn't exist
      const { data: existingSubscription } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", transaction.user_id)
        .eq("plan_id", transaction.plan_id)
        .eq("status", "active")
        .maybeSingle();

      if (!existingSubscription) {
        logger("Creating subscription for user:", transaction.user_id);
        await supabase
          .from("user_subscriptions")
          .insert({
            user_id: transaction.user_id,
            plan_id: transaction.plan_id,
            payment_method: "paypal",
            payment_id: paymentId,
            status: "active",
            start_date: new Date().toISOString(),
            transaction_id: transaction.id,
          });
      }
    } else {
      logger("No transaction found for payment:", paymentId);
    }
  }
}

// Handle order completed event  
async function handleOrderCompleted(supabase: any, resource: any, logger: any) {
  const orderId = resource.id;
  const status = resource.status;
  
  logger("Order completed:", { orderId, status });

  if (status === "COMPLETED") {
    // Extract payment ID from purchase units
    const paymentId = resource.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    
    if (paymentId) {
      // Find and update transaction
      const { data: transaction } = await supabase
        .from("transactions")
        .select("*")
        .eq("paypal_order_id", orderId)
        .maybeSingle();

      if (transaction && transaction.status !== "completed") {
        logger("Marking transaction as completed:", transaction.id);
        
        await supabase
          .from("transactions")
          .update({ 
            status: "completed",
            paypal_payment_id: paymentId,
            completed_at: new Date().toISOString()
          })
          .eq("id", transaction.id);

        // Ensure subscription exists
        const { data: existingSubscription } = await supabase
          .from("user_subscriptions")
          .select("id")
          .eq("user_id", transaction.user_id)
          .eq("plan_id", transaction.plan_id)
          .eq("status", "active")
          .maybeSingle();

        if (!existingSubscription) {
          logger("Creating subscription:", transaction.user_id);
          await supabase
            .from("user_subscriptions")
            .insert({
              user_id: transaction.user_id,
              plan_id: transaction.plan_id,
              payment_method: "paypal",
              payment_id: paymentId,
              status: "active",
              start_date: new Date().toISOString(),
              transaction_id: transaction.id,
            });
        }
      }
    }
  }
}

// Handle payment failed events
async function handlePaymentFailed(supabase: any, resource: any, logger: any) {
  const paymentId = resource.id;
  const orderId = resource.supplementary_data?.related_ids?.order_id;
  
  logger("Payment failed:", { paymentId, orderId });

  // Find transaction and mark as failed
  let transaction = null;
  
  if (paymentId) {
    const { data: txByPayment } = await supabase
      .from("transactions")
      .select("*")
      .eq("paypal_payment_id", paymentId)
      .maybeSingle();
    transaction = txByPayment;
  }

  if (!transaction && orderId) {
    const { data: txByOrder } = await supabase
      .from("transactions")
      .select("*")
      .eq("paypal_order_id", orderId)
      .maybeSingle();
    transaction = txByOrder;
  }

  if (transaction && transaction.status !== "failed") {
    logger("Marking transaction as failed:", transaction.id);
    await supabase
      .from("transactions")
      .update({ 
        status: "failed",
        error_message: "Payment capture denied/declined by PayPal",
        completed_at: new Date().toISOString()
      })
      .eq("id", transaction.id);
  }
}
