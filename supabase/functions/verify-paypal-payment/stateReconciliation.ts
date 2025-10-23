import { createEdgeLogger } from '../_shared/logger.ts';
import { PAYMENT_STATES } from "./types.ts";

const logger = createEdgeLogger('verify-paypal-payment:state-reconciliation');

export async function reconcilePaymentState(context: any) {
  let { payPalStatus, localTx, supabaseClient, userId, planId } = context;

  // Enhanced fallback verification with database state priority
  if (!payPalStatus || [PAYMENT_STATES.ERROR, PAYMENT_STATES.UNKNOWN].includes(payPalStatus)) {
    logger.info('PayPal verification unclear, checking database state', { requestId: context.requestId });
    
    // Check if we have a completed transaction in our database
    if (localTx && localTx.status === "completed" && localTx.paypal_payment_id) {
      logger.info('Found completed transaction in database, treating as success', { requestId: context.requestId });
      payPalStatus = PAYMENT_STATES.COMPLETED;
      context.paymentIdAfterCapture = localTx.paypal_payment_id;
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
        logger.info('Found active subscription, treating as completed', { requestId: context.requestId });
        payPalStatus = PAYMENT_STATES.COMPLETED;
        context.paymentIdAfterCapture = subscription[0].payment_id;
      }
    }
  }

  context.payPalStatus = payPalStatus;
  return context;
}
