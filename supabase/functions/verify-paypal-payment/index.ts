import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getPayPalConfig } from "./paypalConfig.ts";
import { fetchPayPalAccessToken } from "./paypalToken.ts";
import { makeSupabaseClient } from "./dbOperations.ts";
import { fetchPaypalOrder, capturePaypalOrder, fetchPaypalPaymentCapture } from "./paypalApi.ts";
import { PAYMENT_STATES } from "./types.ts";
import { getAllParams } from "./parameterExtractor.ts";
import { databaseFirstVerification } from "./databaseVerification.ts";
import { getTransaction, updateTransactionCompleted, insertUserSubscriptionIfMissing, findAndRecoverOrphanedTransactions } from "./dbOperations.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  const logger = (...args: any[]) => console.log(`[${requestId}]`, ...args);

  try {
    const supabaseClient = makeSupabaseClient();
    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    let accessToken: string;
    try {
      accessToken = await fetchPayPalAccessToken(baseUrl, clientId, clientSecret);
    } catch (err) {
      return new Response(JSON.stringify({ error: "Failed to get PayPal access token.", status: PAYMENT_STATES.ERROR, requestId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ---- Phase 1: Improved Parameter Extraction & Validation ----
    const params = await getAllParams(req);
    // Unify parameter recognition logic
    const orderId = params.order_id || params.token || params.orderId || params.ORDER_ID || params.TOKEN;
    const paymentId = params.payment_id || params.paymentId || params.PAYMENT_ID;
    const planId = params.plan_id || params.planId || params.PLAN_ID;
    const userId = params.user_id || params.userId || params.USER_ID;

    // Preserve original params for debugging
    const debugParams = { ...params, orderId, paymentId, planId, userId };
    logger(`Payment verification params:`, debugParams);

    if (!orderId && !paymentId) {
      logger(`Missing both orderId and paymentId. Params:`, debugParams);
      return new Response(JSON.stringify({
        error: "No order_id or payment_id supplied.",
        errorTips: [
          "Please ensure you are returning to the site via the correct PayPal redirect.",
          "If you used a mobile browser or closed the tab, re-authenticate and try again.",
          "Contact support with this Request ID for help."
        ],
        allParams: debugParams,
        status: PAYMENT_STATES.ERROR,
        success: false,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // PHASE 1: DATABASE-FIRST VERIFICATION - Check existing state
    let localTx = await databaseFirstVerification(supabaseClient, params, logger);
    
    // If we have user/plan context but no transaction, try to find orphaned completed transactions
    if (!localTx && userId && planId) {
      logger(`Looking for orphaned transactions for user ${userId}, plan ${planId}`);
      const recoveryResult = await findAndRecoverOrphanedTransactions(supabaseClient, { user_id: userId, plan_id: planId });
      if (recoveryResult.recovered > 0) {
        // Re-fetch transaction after recovery
        const { data: recoveredTx } = await getTransaction(supabaseClient, { orderId, paymentId });
        if (recoveredTx) {
          localTx = recoveredTx;
          logger(`Recovered orphaned transaction:`, recoveredTx.id);
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
        logger(`Found existing active subscription:`, existingSubscription[0]);
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
    logger(`Phase 2: PayPal API verification`);
    let orderIdToUse = orderId || localTx?.paypal_order_id;
    let paymentIdToUse = paymentId || localTx?.paypal_payment_id;
    let payPalStatus: string | null = null;
    let payPalRawResponse: any = null;
    let txJustCaptured = false;
    let paymentIdAfterCapture: string | null = null;

    if (orderIdToUse) {
      logger(`Fetching PayPal order:`, orderIdToUse);
      const { data: orderData, ok: orderOk } = await fetchPaypalOrder(baseUrl, accessToken, orderIdToUse);
      
      if (!orderOk) {
        logger(`Failed to fetch PayPal order:`, orderData);
        payPalStatus = PAYMENT_STATES.ERROR;
        payPalRawResponse = { error: "Failed to fetch order", details: orderData };
      } else {
        payPalRawResponse = orderData;
        payPalStatus = orderData.status || PAYMENT_STATES.UNKNOWN;

        logger(`PayPal order status:`, payPalStatus);

        // Handle APPROVED status - attempt capture
        if (payPalStatus === "APPROVED") {
          logger(`Order approved, attempting capture...`);
          const { data: captureData, ok: captureOk } = await capturePaypalOrder(baseUrl, accessToken, orderIdToUse);
          
          if (!captureOk) {
            logger(`PayPal capture failed:`, captureData);
            payPalStatus = PAYMENT_STATES.FAILED;
            payPalRawResponse.capture_error = captureData;
          } else {
            payPalRawResponse.capture = captureData;
            payPalStatus = captureData.status || payPalStatus;
            let paymentCaptureObj = captureData.purchase_units?.[0]?.payments?.captures?.[0];
            paymentIdAfterCapture = paymentCaptureObj?.id || null;

            logger(`Capture result:`, { 
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
          
          logger(`Order already completed:`, { paymentIdAfterCapture, captureStatus });
        }
      }
    } else if (paymentIdToUse) {
      logger(`Looking up payment directly:`, paymentIdToUse);
      const { data: paymentData, ok: paymentOk } = await fetchPaypalPaymentCapture(baseUrl, accessToken, paymentIdToUse);
      
      if (!paymentOk) {
        logger(`Failed to fetch PayPal payment:`, paymentData);
        payPalStatus = PAYMENT_STATES.ERROR;
        payPalRawResponse = { error: "Failed to fetch payment", details: paymentData };
      } else {
        payPalRawResponse = paymentData;
        payPalStatus = paymentData.status === "COMPLETED" ? PAYMENT_STATES.COMPLETED : paymentData.status || PAYMENT_STATES.UNKNOWN;
        paymentIdAfterCapture = paymentData.id || null;
        
        logger(`Direct payment lookup result:`, { status: payPalStatus, paymentId: paymentIdAfterCapture });
      }
    }

    // PHASE 3: DATABASE STATE RECONCILIATION
    logger(`Phase 3: Database reconciliation`);
    
    // Enhanced fallback verification with database state priority
    if (!payPalStatus || [PAYMENT_STATES.ERROR, PAYMENT_STATES.UNKNOWN].includes(payPalStatus)) {
      logger(`PayPal verification unclear, checking database state...`);
      
      // Check if we have a completed transaction in our database
      if (localTx && localTx.status === "completed" && localTx.paypal_payment_id) {
        logger(`Found completed transaction in database, treating as success`);
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
          logger(`Found active subscription, treating as completed`);
          payPalStatus = PAYMENT_STATES.COMPLETED;
          paymentIdAfterCapture = subscription[0].payment_id;
        }
      }
    }

    // PHASE 4: DATABASE UPDATE AND SUBSCRIPTION CREATION
    logger(`Phase 4: Database updates`);
    let finalTransaction = localTx;
    let subscription = null;
    let subscriptionCreated: boolean = false; // <-- new flag

    if (payPalStatus === PAYMENT_STATES.COMPLETED) {
      // Update transaction if needed
      if (localTx && (localTx.status !== "completed" || !localTx.paypal_payment_id)) {
        logger(`Updating transaction as completed`);
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
        logger(`Ensuring subscription exists`);
        const subscriptionResult = await insertUserSubscriptionIfMissing(supabaseClient, {
          user_id: finalTransaction.user_id,
          plan_id: finalTransaction.plan_id,
          payment_id: paymentIdAfterCapture || paymentIdToUse || "",
          transaction_id: finalTransaction.id,
        });
        
        if (subscriptionResult.data) {
          subscription = subscriptionResult.data;
          // Set subscriptionCreated to true ONLY if this is a new sub, not an existing
          subscriptionCreated = !!(subscriptionResult.data?.created_at && subscriptionResult.data?.created_at === subscriptionResult.data?.updated_at);
          logger(`Subscription ensured:`, subscription.id, "JustCreated?", subscriptionCreated);
        } else if (subscriptionResult.error) {
          subscriptionCreated = false;
          logger(`Failed to ensure subscription:`, subscriptionResult.error);
        }
      }
    }

    // PHASE 5: RESPONSE FORMATION
    const finalStatus = payPalStatus || PAYMENT_STATES.UNKNOWN;
    const isSuccess = finalStatus === PAYMENT_STATES.COMPLETED;
    
    logger(`Payment verification complete:`, { 
      finalStatus, 
      justCaptured: txJustCaptured, 
      paymentId: paymentIdAfterCapture,
      success: isSuccess,
      hasSubscription: !!subscription,
      subscriptionCreated
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
      subscriptionCreated,
      source: txJustCaptured ? "just_captured" : "existing",
      requestId,
      timestamp: new Date().toISOString(),
      allParams: debugParams
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    logger(`verify-paypal-payment FATAL ERROR:`, error);
    return new Response(JSON.stringify({ 
      error: error.message,
      errorTips: [
        "If your payment succeeded, please try logging out and back in.",
        "If you see this repeatedly, contact support with the Request ID below.",
        "You may also try a different browser if the problem persists."
      ],
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
