
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getPayPalConfig } from "./paypalConfig.ts";
import { fetchPayPalAccessToken } from "./paypalToken.ts";
import { makeSupabaseClient, getTransaction, updateTransactionCompleted, insertUserSubscriptionIfMissing, findAndRecoverOrphanedTransactions } from "./dbOperations.ts";
import { fetchPaypalOrder, capturePaypalOrder, fetchPaypalPaymentCapture } from "./paypalApi.ts";

// Payment state machine for consistent processing
const PAYMENT_STATES = {
  UNKNOWN: 'UNKNOWN',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  ERROR: 'ERROR'
};

// Utility: get params from both URL and POST body
async function getAllParams(req: Request): Promise<{[k: string]: any}> {
  const url = new URL(req.url);
  let params: any = {};
  url.searchParams.forEach((v, k) => { params[k] = v; });
  try {
    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json();
      if (body && typeof body === "object") {
        params = { ...params, ...body };
      }
    }
  } catch {}
  return params;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Payment verification request started`);
  
  try {
    const supabaseClient = makeSupabaseClient();
    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    let accessToken: string;
    
    try {
      accessToken = await fetchPayPalAccessToken(baseUrl, clientId, clientSecret);
    } catch (err) {
      console.error(`[${requestId}] PayPal access token fetch failed:`, err);
      return new Response(JSON.stringify({ 
        error: "Failed to get PayPal access token.",
        status: PAYMENT_STATES.ERROR,
        success: false,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const params = await getAllParams(req);
    const orderId = params.order_id || params.token || params.orderId;
    const paymentId = params.payment_id || params.paymentId;
    const planId = params.plan_id || params.planId;
    const userId = params.user_id || params.userId;

    console.log(`[${requestId}] Payment verification params:`, { orderId, paymentId, planId, userId });

    if (!orderId && !paymentId) {
      return new Response(JSON.stringify({ 
        error: "No order_id or payment_id supplied.",
        status: PAYMENT_STATES.ERROR,
        success: false,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // PHASE 1: DATABASE-FIRST VERIFICATION - Check existing state
    console.log(`[${requestId}] Phase 1: Database verification`);
    let { data: localTx } = await getTransaction(supabaseClient, { orderId, paymentId });
    
    // If we have user/plan context but no transaction, try to find orphaned completed transactions
    if (!localTx && userId && planId) {
      console.log(`[${requestId}] Looking for orphaned transactions for user ${userId}, plan ${planId}`);
      const recoveryResult = await findAndRecoverOrphanedTransactions(supabaseClient, { user_id: userId, plan_id: planId });
      if (recoveryResult.recovered > 0) {
        // Re-fetch transaction after recovery
        const { data: recoveredTx } = await getTransaction(supabaseClient, { orderId, paymentId });
        if (recoveredTx) {
          localTx = recoveredTx;
          console.log(`[${requestId}] Recovered orphaned transaction:`, recoveredTx.id);
        }
      }
    }

    // Check if subscription already exists for this transaction
    if (localTx?.user_id && localTx?.plan_id) {
      const { data: existingSubscription } = await supabaseClient
        .from("user_subscriptions")
        .select("id, payment_id, status, created_at, transaction_id")
        .eq("user_id", localTx.user_id)
        .eq("plan_id", localTx.plan_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingSubscription && existingSubscription.length > 0) {
        console.log(`[${requestId}] Found existing active subscription:`, existingSubscription[0]);
        return new Response(JSON.stringify({
          status: PAYMENT_STATES.COMPLETED,
          success: true,
          justCaptured: false,
          paymentId: existingSubscription[0].payment_id,
          paypal: { status: "COMPLETED" },
          transaction: localTx,
          subscription: existingSubscription[0],
          source: "existing_subscription",
          requestId
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // PHASE 2: PAYPAL API VERIFICATION
    console.log(`[${requestId}] Phase 2: PayPal API verification`);
    let orderIdToUse = orderId || localTx?.paypal_order_id;
    let paymentIdToUse = paymentId || localTx?.paypal_payment_id;
    let payPalStatus: string | null = null;
    let payPalRawResponse: any = null;
    let txJustCaptured = false;
    let paymentIdAfterCapture: string | null = null;

    if (orderIdToUse) {
      console.log(`[${requestId}] Fetching PayPal order:`, orderIdToUse);
      const { data: orderData, ok: orderOk } = await fetchPaypalOrder(baseUrl, accessToken, orderIdToUse);
      
      if (!orderOk) {
        console.error(`[${requestId}] Failed to fetch PayPal order:`, orderData);
        payPalStatus = PAYMENT_STATES.ERROR;
        payPalRawResponse = { error: "Failed to fetch order", details: orderData };
      } else {
        payPalRawResponse = orderData;
        payPalStatus = orderData.status || PAYMENT_STATES.UNKNOWN;

        console.log(`[${requestId}] PayPal order status:`, payPalStatus);

        // Handle APPROVED status - attempt capture
        if (payPalStatus === "APPROVED") {
          console.log(`[${requestId}] Order approved, attempting capture...`);
          const { data: captureData, ok: captureOk } = await capturePaypalOrder(baseUrl, accessToken, orderIdToUse);
          
          if (!captureOk) {
            console.error(`[${requestId}] PayPal capture failed:`, captureData);
            payPalStatus = PAYMENT_STATES.FAILED;
            payPalRawResponse.capture_error = captureData;
          } else {
            payPalRawResponse.capture = captureData;
            payPalStatus = captureData.status || payPalStatus;
            let paymentCaptureObj = captureData.purchase_units?.[0]?.payments?.captures?.[0];
            paymentIdAfterCapture = paymentCaptureObj?.id || null;

            console.log(`[${requestId}] Capture result:`, { 
              captureStatus: payPalStatus, 
              paymentCaptureStatus: paymentCaptureObj?.status,
              paymentIdAfterCapture 
            });

            if (payPalStatus === "COMPLETED" || paymentCaptureObj?.status === "COMPLETED") {
              txJustCaptured = true;
              payPalStatus = PAYMENT_STATES.COMPLETED;
            }
          }
        } 
        // Handle already COMPLETED status
        else if (payPalStatus === "COMPLETED" && orderData.purchase_units?.[0]?.payments?.captures?.[0]) {
          paymentIdAfterCapture = orderData.purchase_units[0].payments.captures[0].id || null;
          const captureStatus = orderData.purchase_units[0].payments.captures[0].status;
          payPalStatus = captureStatus === "COMPLETED" ? PAYMENT_STATES.COMPLETED : payPalStatus;
          
          console.log(`[${requestId}] Order already completed:`, { paymentIdAfterCapture, captureStatus });
        }
      }
    } else if (paymentIdToUse) {
      console.log(`[${requestId}] Looking up payment directly:`, paymentIdToUse);
      const { data: paymentData, ok: paymentOk } = await fetchPaypalPaymentCapture(baseUrl, accessToken, paymentIdToUse);
      
      if (!paymentOk) {
        console.error(`[${requestId}] Failed to fetch PayPal payment:`, paymentData);
        payPalStatus = PAYMENT_STATES.ERROR;
        payPalRawResponse = { error: "Failed to fetch payment", details: paymentData };
      } else {
        payPalRawResponse = paymentData;
        payPalStatus = paymentData.status === "COMPLETED" ? PAYMENT_STATES.COMPLETED : paymentData.status || PAYMENT_STATES.UNKNOWN;
        paymentIdAfterCapture = paymentData.id || null;
        
        console.log(`[${requestId}] Direct payment lookup result:`, { status: payPalStatus, paymentId: paymentIdAfterCapture });
      }
    }

    // PHASE 3: DATABASE STATE RECONCILIATION
    console.log(`[${requestId}] Phase 3: Database reconciliation`);
    
    // Enhanced fallback verification with database state priority
    if (!payPalStatus || [PAYMENT_STATES.ERROR, PAYMENT_STATES.UNKNOWN].includes(payPalStatus)) {
      console.log(`[${requestId}] PayPal verification unclear, checking database state...`);
      
      // Check if we have a completed transaction in our database
      if (localTx && localTx.status === "completed" && localTx.paypal_payment_id) {
        console.log(`[${requestId}] Found completed transaction in database, treating as success`);
        payPalStatus = PAYMENT_STATES.COMPLETED;
        paymentIdAfterCapture = localTx.paypal_payment_id;
      } else if (localTx?.user_id && localTx?.plan_id) {
        // Check if user has an active subscription for this plan
        const { data: subscription } = await supabaseClient
          .from("user_subscriptions")
          .select("payment_id, status, transaction_id")
          .eq("user_id", localTx.user_id)
          .eq("plan_id", localTx.plan_id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);

        if (subscription && subscription.length > 0) {
          console.log(`[${requestId}] Found active subscription, treating as completed`);
          payPalStatus = PAYMENT_STATES.COMPLETED;
          paymentIdAfterCapture = subscription[0].payment_id;
        }
      }
    }

    // PHASE 4: DATABASE UPDATE AND SUBSCRIPTION CREATION
    console.log(`[${requestId}] Phase 4: Database updates`);
    let finalTransaction = localTx;
    let subscription = null;

    if (payPalStatus === PAYMENT_STATES.COMPLETED) {
      // Update transaction if needed
      if (localTx && (localTx.status !== "completed" || !localTx.paypal_payment_id)) {
        console.log(`[${requestId}] Updating transaction as completed`);
        const updateResult = await updateTransactionCompleted(supabaseClient, { 
          id: localTx.id, 
          paypal_payment_id: paymentIdAfterCapture || paymentIdToUse || "" 
        });
        if (updateResult.data) {
          finalTransaction = updateResult.data;
        }
      }

      // Ensure subscription exists for completed payment
      if (finalTransaction?.user_id && finalTransaction?.plan_id) {
        console.log(`[${requestId}] Ensuring subscription exists`);
        const subscriptionResult = await insertUserSubscriptionIfMissing(supabaseClient, {
          user_id: finalTransaction.user_id,
          plan_id: finalTransaction.plan_id,
          payment_id: paymentIdAfterCapture || paymentIdToUse || "",
          transaction_id: finalTransaction.id,
        });
        
        if (subscriptionResult.data) {
          subscription = subscriptionResult.data;
          console.log(`[${requestId}] Subscription ensured:`, subscription.id);
        } else if (subscriptionResult.error) {
          console.error(`[${requestId}] Failed to ensure subscription:`, subscriptionResult.error);
          // Don't fail the entire verification if subscription creation fails
          // The payment is still successful
        }
      }
    }

    // PHASE 5: RESPONSE FORMATION
    const finalStatus = payPalStatus || PAYMENT_STATES.UNKNOWN;
    const isSuccess = finalStatus === PAYMENT_STATES.COMPLETED;
    
    console.log(`[${requestId}] Payment verification complete:`, { 
      finalStatus, 
      justCaptured: txJustCaptured, 
      paymentId: paymentIdAfterCapture,
      success: isSuccess,
      hasSubscription: !!subscription
    });

    // Consistent response format with enhanced data
    return new Response(JSON.stringify({
      status: finalStatus,
      success: isSuccess,
      justCaptured: txJustCaptured,
      paymentId: paymentIdAfterCapture || paymentIdToUse,
      paypal: payPalRawResponse,
      transaction: finalTransaction,
      subscription: subscription,
      source: txJustCaptured ? "just_captured" : "existing",
      requestId,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error(`[${requestId}] verify-paypal-payment FATAL ERROR:`, error);
    return new Response(JSON.stringify({ 
      error: error.message,
      status: PAYMENT_STATES.ERROR,
      success: false,
      requestId,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
