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
      console.log("PayPal access token fetch failed:", err);
      return new Response(JSON.stringify({ error: "Failed to get PayPal access token." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const params = await getAllParams(req);
    const orderId = params.order_id || params.token || params.orderId;
    const paymentId = params.payment_id || params.paymentId;

    if (!orderId && !paymentId) {
      return new Response(JSON.stringify({ error: "No order_id or payment_id supplied." }), {
        status: 400,
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

    if (orderIdToUse) {
      // Always fetch the latest PayPal order data
      const { data: orderData } = await fetchPaypalOrder(baseUrl, accessToken, orderIdToUse);
      payPalRawResponse = orderData;
      payPalStatus = orderData.status || null;

      // If status is APPROVED, capture the payment
      if (payPalStatus === "APPROVED") {
        const { data: captureData } = await capturePaypalOrder(baseUrl, accessToken, orderIdToUse);
        payPalRawResponse.capture = captureData;
        payPalStatus = captureData.status || payPalStatus;
        let paymentCaptureObj = captureData.purchase_units?.[0]?.payments?.captures?.[0];
        paymentIdAfterCapture = paymentCaptureObj?.id || null;

        if (payPalStatus === "COMPLETED" || paymentCaptureObj?.status === "COMPLETED") {
          txJustCaptured = true;
          if (localTx && paymentIdAfterCapture) {
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
      } else if (payPalStatus === "COMPLETED" && orderData.purchase_units?.[0]?.payments?.captures?.[0]?.status) {
        paymentIdAfterCapture = orderData.purchase_units[0].payments.captures[0].id || null;
        payPalStatus = orderData.purchase_units[0].payments.captures[0].status;
        // Update DB if needed
        if (localTx && paymentIdAfterCapture && (localTx.status !== "completed" || !localTx.paypal_payment_id)) {
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
    } else if (paymentIdToUse) {
      // Lookup payment directly
      const { data: paymentData } = await fetchPaypalPaymentCapture(baseUrl, accessToken, paymentIdToUse);
      payPalRawResponse = paymentData;
      payPalStatus = paymentData.status || null;
      paymentIdAfterCapture = paymentData.id || null;
    }

    if (!payPalStatus) {
      // Return error as 200 so frontend can handle it kindly and not confuse payment state with real function error
      return new Response(JSON.stringify({ 
        error: "Could not determine PayPal payment status.",
        paypal: payPalRawResponse,
        status: "UNKNOWN"
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // If status is COMPLETED but DB is not updated
    if (localTx && payPalStatus && (["COMPLETED", "completed"].includes(payPalStatus)) && (localTx.status?.toUpperCase() !== payPalStatus.toUpperCase() || !localTx.paypal_payment_id)) {
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

    // Return 200 for ALL verified payment paths, even if not COMPLETED, allow app to decide what to do.
    return new Response(JSON.stringify({
      status: payPalStatus?.toUpperCase?.() || payPalStatus,
      justCaptured: txJustCaptured,
      paymentId: paymentIdAfterCapture,
      paypal: payPalRawResponse,
      transaction: localTx
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("verify-paypal-payment FATAL: ", error);
    // If PayPal is unreachable or code fails, only then return 500
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
