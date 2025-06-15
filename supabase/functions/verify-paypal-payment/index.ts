
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getPayPalConfig } from "./paypalConfig.ts";
import { fetchPayPalAccessToken } from "./paypalToken.ts";
import { makeSupabaseClient, getTransaction, updateTransactionCompleted, insertUserSubscriptionIfMissing } from "./dbOperations.ts";
import { fetchPaypalOrder, capturePaypalOrder, fetchPaypalPaymentCapture } from "./paypalApi.ts";

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
  
  try {
    const supabaseClient = makeSupabaseClient();
    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    let accessToken: string;
    
    try {
      accessToken = await fetchPayPalAccessToken(baseUrl, clientId, clientSecret);
    } catch (err) {
      console.error("PayPal access token fetch failed:", err);
      return new Response(JSON.stringify({ 
        error: "Failed to get PayPal access token.",
        status: "ERROR",
        success: false
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const params = await getAllParams(req);
    const orderId = params.order_id || params.token || params.orderId;
    const paymentId = params.payment_id || params.paymentId;

    console.log('Payment verification request:', { orderId, paymentId, allParams: params });

    if (!orderId && !paymentId) {
      return new Response(JSON.stringify({ 
        error: "No order_id or payment_id supplied.",
        status: "ERROR",
        success: false
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let { data: localTx } = await getTransaction(supabaseClient, { orderId, paymentId });
    let orderIdToUse = orderId || localTx?.paypal_order_id;
    let paymentIdToUse = paymentId || localTx?.paypal_payment_id;
    let payPalStatus: string | null = null;
    let payPalRawResponse: any = null;
    let txJustCaptured = false;
    let paymentIdAfterCapture: string | null = null;

    console.log('Processing payment verification:', { 
      orderIdToUse, 
      paymentIdToUse, 
      hasLocalTx: !!localTx,
      localTxStatus: localTx?.status 
    });

    // SESSION-INDEPENDENT: Priority check for existing subscription
    if (localTx?.user_id && localTx?.plan_id) {
      const { data: existingSubscription } = await supabaseClient
        .from("user_subscriptions")
        .select("id, payment_id, status, created_at")
        .eq("user_id", localTx.user_id)
        .eq("plan_id", localTx.plan_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (existingSubscription && existingSubscription.length > 0) {
        console.log('Found existing active subscription, returning success:', existingSubscription[0]);
        return new Response(JSON.stringify({
          status: "COMPLETED",
          success: true,
          justCaptured: false,
          paymentId: existingSubscription[0].payment_id,
          paypal: { status: "COMPLETED" },
          transaction: localTx,
          source: "existing_subscription"
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // PayPal verification process
    if (orderIdToUse) {
      // Fetch the latest PayPal order data
      const { data: orderData, ok: orderOk } = await fetchPaypalOrder(baseUrl, accessToken, orderIdToUse);
      
      if (!orderOk) {
        console.error('Failed to fetch PayPal order:', orderData);
        payPalStatus = "VERIFICATION_FAILED";
        payPalRawResponse = { error: "Failed to fetch order", details: orderData };
      } else {
        payPalRawResponse = orderData;
        payPalStatus = orderData.status || null;

        console.log('PayPal order status:', { orderId: orderIdToUse, status: payPalStatus });

        // If status is APPROVED, capture the payment
        if (payPalStatus === "APPROVED") {
          console.log('Order is approved, attempting capture...');
          const { data: captureData, ok: captureOk } = await capturePaypalOrder(baseUrl, accessToken, orderIdToUse);
          
          if (!captureOk) {
            console.error('PayPal capture failed:', captureData);
            payPalStatus = "CAPTURE_FAILED";
            payPalRawResponse.capture_error = captureData;
          } else {
            payPalRawResponse.capture = captureData;
            payPalStatus = captureData.status || payPalStatus;
            let paymentCaptureObj = captureData.purchase_units?.[0]?.payments?.captures?.[0];
            paymentIdAfterCapture = paymentCaptureObj?.id || null;

            console.log('Capture result:', { 
              captureStatus: payPalStatus, 
              paymentCaptureStatus: paymentCaptureObj?.status,
              paymentIdAfterCapture 
            });

            if (payPalStatus === "COMPLETED" || paymentCaptureObj?.status === "COMPLETED") {
              txJustCaptured = true;
              if (localTx && paymentIdAfterCapture) {
                console.log('Updating transaction as completed:', { txId: localTx.id, paymentId: paymentIdAfterCapture });
                await updateTransactionCompleted(supabaseClient, { id: localTx.id, paypal_payment_id: paymentIdAfterCapture });
                if (localTx.user_id && localTx.plan_id) {
                  await insertUserSubscriptionIfMissing(supabaseClient, {
                    user_id: localTx.user_id,
                    plan_id: localTx.plan_id,
                    payment_id: paymentIdAfterCapture,
                    transaction_id: localTx.id,
                  });
                }
              }
            }
          }
        } else if (payPalStatus === "COMPLETED" && orderData.purchase_units?.[0]?.payments?.captures?.[0]) {
          paymentIdAfterCapture = orderData.purchase_units[0].payments.captures[0].id || null;
          const captureStatus = orderData.purchase_units[0].payments.captures[0].status;
          payPalStatus = captureStatus;
          
          console.log('Order already completed:', { paymentIdAfterCapture, captureStatus });
          
          // Update DB if needed
          if (localTx && paymentIdAfterCapture && (localTx.status !== "completed" || !localTx.paypal_payment_id)) {
            console.log('Updating existing transaction:', { txId: localTx.id, paymentId: paymentIdAfterCapture });
            await updateTransactionCompleted(supabaseClient, { id: localTx.id, paypal_payment_id: paymentIdAfterCapture });
            if (localTx.user_id && localTx.plan_id) {
              await insertUserSubscriptionIfMissing(supabaseClient, {
                user_id: localTx.user_id,
                plan_id: localTx.plan_id,
                payment_id: paymentIdAfterCapture,
                transaction_id: localTx.id,
              });
            }
          }
        }
      }
    } else if (paymentIdToUse) {
      // Lookup payment directly
      console.log('Looking up payment directly:', paymentIdToUse);
      const { data: paymentData, ok: paymentOk } = await fetchPaypalPaymentCapture(baseUrl, accessToken, paymentIdToUse);
      
      if (!paymentOk) {
        console.error('Failed to fetch PayPal payment:', paymentData);
        payPalStatus = "VERIFICATION_FAILED";
        payPalRawResponse = { error: "Failed to fetch payment", details: paymentData };
      } else {
        payPalRawResponse = paymentData;
        payPalStatus = paymentData.status || null;
        paymentIdAfterCapture = paymentData.id || null;
        
        console.log('Direct payment lookup result:', { status: payPalStatus, paymentId: paymentIdAfterCapture });
      }
    }

    // Enhanced fallback verification
    if (!payPalStatus || ["VERIFICATION_FAILED", "CAPTURE_FAILED"].includes(payPalStatus)) {
      console.log('PayPal verification unclear, checking database for completed transaction...');
      
      // Check if we have a completed transaction in our database
      if (localTx && localTx.status === "completed" && localTx.paypal_payment_id) {
        console.log('Found completed transaction in database, treating as success');
        payPalStatus = "COMPLETED";
        paymentIdAfterCapture = localTx.paypal_payment_id;
      } else if (localTx?.user_id && localTx?.plan_id) {
        // Check if user has an active subscription for this plan
        const { data: subscription } = await supabaseClient
          .from("user_subscriptions")
          .select("payment_id, status")
          .eq("user_id", localTx.user_id)
          .eq("plan_id", localTx.plan_id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);

        if (subscription && subscription.length > 0) {
          console.log('Found active subscription, treating as completed');
          payPalStatus = "COMPLETED";
          paymentIdAfterCapture = subscription[0].payment_id;
        }
      }
    }

    // Final DB update for completed payments
    if (localTx && payPalStatus && (["COMPLETED", "completed"].includes(payPalStatus)) && (localTx.status?.toUpperCase() !== payPalStatus.toUpperCase() || !localTx.paypal_payment_id)) {
      console.log('Final DB update for completed payment:', { txId: localTx.id, status: payPalStatus });
      await updateTransactionCompleted(supabaseClient, { id: localTx.id, paypal_payment_id: paymentIdAfterCapture });
      if (localTx.user_id && localTx.plan_id) {
        await insertUserSubscriptionIfMissing(supabaseClient, {
          user_id: localTx.user_id,
          plan_id: localTx.plan_id,
          payment_id: paymentIdAfterCapture,
          transaction_id: localTx.id,
        });
      }
    }

    const finalStatus = payPalStatus?.toUpperCase?.() || payPalStatus || "UNKNOWN";
    const isSuccess = ["COMPLETED", "completed"].includes(finalStatus);
    
    console.log('Payment verification complete:', { 
      finalStatus, 
      justCaptured: txJustCaptured, 
      paymentId: paymentIdAfterCapture,
      success: isSuccess
    });

    // Consistent response format
    return new Response(JSON.stringify({
      status: finalStatus,
      success: isSuccess,
      justCaptured: txJustCaptured,
      paymentId: paymentIdAfterCapture,
      paypal: payPalRawResponse,
      transaction: localTx,
      source: txJustCaptured ? "just_captured" : "existing"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("verify-paypal-payment FATAL ERROR:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      status: "ERROR",
      success: false
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
