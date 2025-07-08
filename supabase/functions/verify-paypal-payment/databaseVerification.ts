
import { getTransaction } from "./dbOperations.ts";
import { findAndRecoverOrphanedTransactions } from "./dbOperations.ts";
import { PAYMENT_STATES } from "./types.ts";

export async function databaseFirstVerification(supabaseClient: any, params: any, logger: (msg: string, ...args: any[]) => void) {
  const { orderId, paymentId, planId, userId } = params;
  logger("Phase 1: Database verification");
  let { data: localTx } = await getTransaction(supabaseClient, { orderId, paymentId });

  if (!localTx && userId && planId) {
    logger("Looking for orphaned transactions for user", userId, "plan", planId);
    const recoveryResult = await findAndRecoverOrphanedTransactions(supabaseClient, { user_id: userId, plan_id: planId });
    if (recoveryResult.recovered > 0) {
      const { data: recoveredTx } = await getTransaction(supabaseClient, { orderId, paymentId });
      if (recoveredTx) {
        localTx = recoveredTx;
        logger("Recovered orphaned transaction", recoveredTx.id);
      }
    }
  }
  return localTx;
}
