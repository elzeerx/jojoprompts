import { fetchPaypalOrder, capturePaypalOrder, fetchPaypalPaymentCapture } from "./paypalApi.ts";
import { PAYMENT_STATES, VerificationContext } from "./types.ts";

export async function paypalApiVerification(context: VerificationContext) {
  const { requestId, accessToken, params, supabaseClient } = context;
  const { orderId, paymentId } = params;
  let orderIdToUse = orderId || context.localTx?.paypal_order_id;
  let paymentIdToUse = paymentId || context.localTx?.paypal_payment_id;
  let payPalStatus: string | null = null;
  let payPalRawResponse: any = null;
  let txJustCaptured = false;
  let paymentIdAfterCapture: string | null = null;

  if (orderIdToUse) {
    console.log(`[${requestId}] Fetching PayPal order:`, orderIdToUse);
    const { data: orderData, ok: orderOk } = await fetchPaypalOrder(context.baseUrl, accessToken, orderIdToUse);
    
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
        const { data: captureData, ok: captureOk } = await capturePaypalOrder(context.baseUrl, accessToken, orderIdToUse);
        
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
    const { data: paymentData, ok: paymentOk } = await fetchPaypalPaymentCapture(context.baseUrl, accessToken, paymentIdToUse);
    
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

  return {
    payPalStatus,
    payPalRawResponse,
    txJustCaptured,
    paymentIdAfterCapture
  };
}
