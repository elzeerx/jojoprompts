import { insertUserSubscriptionIfMissing, updateTransactionCompleted } from "./dbOperations.ts";
import { PAYMENT_STATES } from "./types.ts";

export async function manageSubscription(context: any, txJustCaptured: boolean, paymentIdAfterCapture: string | null) {
  let finalTransaction = context.localTx;
  let subscription = null;
  let subscriptionCreated: boolean = false;

  if (context.payPalStatus === PAYMENT_STATES.COMPLETED) {
    if (context.localTx && (context.localTx.status !== "completed" || !context.localTx.paypal_payment_id)) {
      context.logger("Updating transaction as completed");
      const updateResult = await updateTransactionCompleted(context.supabaseClient, {
        id: context.localTx.id,
        paypal_payment_id: paymentIdAfterCapture || context.paymentIdToUse || ""
      });
      if (updateResult.data) {
        finalTransaction = updateResult.data;
      }
    }

    if (finalTransaction?.user_id && finalTransaction?.plan_id) {
      context.logger("Ensuring subscription exists");
      const subscriptionResult = await insertUserSubscriptionIfMissing(context.supabaseClient, {
        user_id: finalTransaction.user_id,
        plan_id: finalTransaction.plan_id,
        payment_id: paymentIdAfterCapture || context.paymentIdToUse || "",
        transaction_id: finalTransaction.id,
      });

      if (subscriptionResult.data) {
        subscription = subscriptionResult.data;
        subscriptionCreated = !!(subscriptionResult.data?.created_at && subscriptionResult.data?.created_at === subscriptionResult.data?.updated_at);
        context.logger("Subscription ensured:", subscription.id, "JustCreated?", subscriptionCreated);
      } else if (subscriptionResult.error) {
        subscriptionCreated = false;
        context.logger("Failed to ensure subscription:", subscriptionResult.error);
      }
    }
  }

  return { finalTransaction, subscription, subscriptionCreated };
}
