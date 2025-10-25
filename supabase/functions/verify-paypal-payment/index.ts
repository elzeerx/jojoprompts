import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getPayPalConfig } from "./paypalConfig.ts";
import { fetchPayPalAccessToken } from "./paypalToken.ts";
import { makeSupabaseClient } from "./dbOperations.ts";
import { fetchPaypalOrder, capturePaypalOrder, fetchPaypalPaymentCapture } from "./paypalApi.ts";
import { PAYMENT_STATES } from "./types.ts";
import { getAllParams } from "./parameterExtractor.ts";
import { databaseFirstVerification } from "./databaseVerification.ts";
import { getTransaction, updateTransactionCompleted, insertUserSubscriptionIfMissing } from "./dbOperations.ts";
import { logEmailAttempt } from "./emailLogger.ts";
import { createEdgeLogger, generateRequestId } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Payment confirmation email using database template
async function sendPaymentConfirmationEmail(supabaseClient: any, userEmail: string, userName: string, planName: string, amount: number, transactionId: string, logger: any) {
  try {
    logger.info('Sending payment confirmation email', { email: userEmail });
    
    // Format purchase date
    const purchaseDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Use the email template system with payment_confirmation template
    const emailData = {
      to: userEmail,
      template_slug: 'payment_confirmation',
      email_type: 'payment_confirmation',
      user_id: null,
      variables: {
        first_name: userName.split(' ')[0] || 'Valued Customer',
        plan_name: planName,
        amount: amount.toFixed(2),
        transaction_id: transactionId,
        purchase_date: purchaseDate,
        email: userEmail
      }
    };

    // Simple email logging
    await logEmailAttempt(supabaseClient, userEmail, 'payment_confirmation', false, null, null);

    const { data: emailResponse, error: emailError } = await supabaseClient.functions.invoke('send-email', {
      body: emailData
    });

    if (emailError || !emailResponse?.success) {
      logger.error('Error sending email', { error: emailError?.message || emailResponse?.error });
      await logEmailAttempt(supabaseClient, userEmail, 'payment_confirmation', false, emailError?.message || emailResponse?.error);
      return { success: false, error: emailError?.message || emailResponse?.error };
    }

    logger.info('Payment confirmation email sent successfully', { email: userEmail });
    await logEmailAttempt(supabaseClient, userEmail, 'payment_confirmation', true, transactionId);
    return { success: true };
  } catch (error: any) {
    logger.error('Exception sending email', { error: error.message });
    await logEmailAttempt(supabaseClient, userEmail, 'payment_confirmation', false, error.message);
    return { success: false, error: error.message };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = generateRequestId();
  const logger = createEdgeLogger('VERIFY_PAYPAL_PAYMENT', requestId);

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

    // Simplified parameter extraction
    const params = await getAllParams(req);

    function extract(keys: string[]) {
      for (const k of keys) {
        if (params[k]) return params[k];
        if (params[k.toLowerCase()]) return params[k.toLowerCase()];
        if (params[k.toUpperCase()]) return params[k.toUpperCase()];
      }
      return undefined;
    }
    
    const orderId = extract(["order_id", "token", "orderId", "ORDER_ID", "TOKEN"]);
    const paymentId = extract(["payment_id", "paymentId", "PAYMENT_ID"]);
    const planId = extract(["plan_id", "planId", "PLAN_ID"]);
    const userId = extract(["user_id", "userId", "USER_ID"]);

    const debugParams = { ...params, orderId, paymentId, planId, userId };
    logger.info('Payment verification started', { params: debugParams });

    if (!orderId && !paymentId) {
      logger.error('Missing both orderId and paymentId', { params: debugParams });
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

    // Database-first verification
    let localTx = await databaseFirstVerification(supabaseClient, { orderId, paymentId, planId, userId }, logger);

    // If we have a completed transaction and active subscription, return success
    if (localTx?.status === "completed" && localTx?.user_id && localTx?.plan_id) {
      const { data: existingSubscription } = await supabaseClient
        .from("user_subscriptions")
        .select("id, payment_id, status, created_at, transaction_id")
        .eq("user_id", localTx.user_id)
        .eq("plan_id", localTx.plan_id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .maybeSingle();
        
      if (existingSubscription && existingSubscription.status === "active") {
        logger.info('SUCCESS: Database shows completed transaction and active subscription');
        
        // Get plan and user data for email
        const { data: planData } = await supabaseClient
          .from("subscription_plans")
          .select("name, price_usd")
          .eq("id", localTx.plan_id)
          .single();

        const { data: userData } = await supabaseClient
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", localTx.user_id)
          .single();

        const { data: { user: authUser } } = await supabaseClient.auth.admin.getUserById(localTx.user_id);
        
        // Send confirmation email (simplified)
        if (authUser?.email && planData && userData) {
          const userName = `${userData.first_name} ${userData.last_name}`.trim() || 'Valued Customer';
          const transactionIdForEmail = localTx.paypal_payment_id || localTx.id;
          
          const emailResult = await sendPaymentConfirmationEmail(
            supabaseClient,
            authUser.email,
            userName,
            planData.name || 'Premium Plan',
            planData.price_usd || 0,
            transactionIdForEmail,
            logger
          );
          
          if (!emailResult.success) {
            logger.warn('Failed to send confirmation email', { error: emailResult.error });
          }
        }

        return new Response(JSON.stringify({
          status: PAYMENT_STATES.COMPLETED,
          success: true,
          paymentId: existingSubscription.payment_id,
          paypal: { status: "COMPLETED" },
          transaction: localTx,
          subscription: existingSubscription,
          source: "database_verification",
          requestId,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Simplified PayPal API verification (removed complex capture logic)
    logger.info('PayPal API verification', { orderId: orderId || 'none', paymentId: paymentId || 'none' });
    
    let orderIdToUse = orderId || localTx?.paypal_order_id;
    let payPalStatus: string | null = null;
    let payPalRawResponse: any = null;

    if (orderIdToUse) {
      logger.debug('Fetching PayPal order', { orderId: orderIdToUse });
      const { data: orderData, ok: orderOk } = await fetchPaypalOrder(baseUrl, accessToken, orderIdToUse);
      
      if (orderOk) {
        payPalRawResponse = orderData;
        payPalStatus = orderData.status || PAYMENT_STATES.UNKNOWN;
        logger.info('PayPal order status retrieved', { status: payPalStatus });
      } else {
        logger.error('Failed to fetch PayPal order', { error: orderData });
        payPalStatus = PAYMENT_STATES.ERROR;
      }
    } else if (paymentId) {
      logger.debug('Fetching PayPal payment capture', { paymentId });
      const { data: paymentData, ok: paymentOk } = await fetchPaypalPaymentCapture(baseUrl, accessToken, paymentId);
      
      if (paymentOk) {
        payPalRawResponse = paymentData;
        payPalStatus = paymentData.status || PAYMENT_STATES.UNKNOWN;
        logger.info('PayPal payment status retrieved', { status: payPalStatus });
      } else {
        logger.error('Failed to fetch PayPal payment', { error: paymentData });
        payPalStatus = PAYMENT_STATES.ERROR;
      }
    }

    // If payment is completed, send confirmation email using template
    if (payPalStatus === "COMPLETED" && userId && planId) {
      logger.info('Payment completed successfully, sending confirmation email');
      
      // Get user and plan details for email
      const { data: userProfile } = await supabaseClient
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .single();
      
      const { data: planDetails } = await supabaseClient
        .from('subscription_plans')
        .select('name, price_usd')
        .eq('id', planId)
        .single();
      
      if (userProfile && planDetails) {
        const userName = `${userProfile.first_name} ${userProfile.last_name}`.trim();
        const { data: { user: authUser } } = await supabaseClient.auth.admin.getUserById(userId);
        
        if (authUser?.email) {
          // Send confirmation email in background
          setTimeout(async () => {
            await sendPaymentConfirmationEmail(
              supabaseClient,
              authUser.email,
              userName,
              planDetails.name,
              planDetails.price_usd || 0,
              paymentId || orderIdToUse || 'unknown',
              logger
            );
          }, 0);
        }
      }
    }

    // Simplified response - just return the status
    return new Response(JSON.stringify({
      status: payPalStatus || PAYMENT_STATES.UNKNOWN,
      success: payPalStatus === "COMPLETED",
      paymentId: paymentId,
      orderId: orderIdToUse,
      paypal: payPalRawResponse,
      transaction: localTx,
      source: "paypal_api_verification",
      requestId,
      timestamp: new Date().toISOString(),
      allParams: debugParams
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    logger.error('Verification error', { error: error.message });
    return new Response(JSON.stringify({
      error: error.message,
      status: PAYMENT_STATES.ERROR,
      success: false,
      requestId
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});