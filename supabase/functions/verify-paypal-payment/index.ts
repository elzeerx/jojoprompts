
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getPayPalConfig } from "./paypalConfig.ts";
import { fetchPayPalAccessToken } from "./paypalToken.ts";
import { makeSupabaseClient, getTransaction, updateTransactionCompleted, insertUserSubscriptionIfMissing } from "./dbOperations.ts";
import { fetchPaypalOrder, capturePaypalOrder, fetchPaypalPaymentCapture } from "./paypalApi.ts";

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
    const url = new URL(req.url);
    const orderId = url.searchParams.get("order_id") || url.searchParams.get("orderId");
    const paymentId = url.searchParams.get("payment_id") || url.searchParams.get("paymentId");

    if (!orderId && !paymentId) {
      return new Response(JSON.stringify({ error: "No order_id or payment_id supplied." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { clientId, clientSecret, baseUrl } = getPayPalConfig();
    let accessToken: string;
    try {
      accessToken = await fetchPayPalAccessToken(baseUrl, clientId, clientSecret);
    } catch (err) {
      console.log("PayPal access token fetch failed:", err);
      return new Response(JSON.stringify({ error: "Failed to get PayPal access token." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
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
      // Fetch PayPal order
      const { data: orderData } = await fetchPaypalOrder(baseUrl, accessToken, orderIdToUse);
      payPalRawResponse = orderData;
      payPalStatus = orderData.status || null;

      // If status is APPROVED, capture payment
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
      return new Response(JSON.stringify({ error: "Could not determine PayPal payment status.", paypal: payPalRawResponse }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
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

    return new Response(JSON.stringify({
      status: payPalStatus?.toUpperCase?.() || payPalStatus,
      justCaptured: txJustCaptured,
      paymentId: paymentIdAfterCapture,
      paypal: payPalRawResponse,
      transaction: localTx
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("verify-paypal-payment FATAL: ", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
