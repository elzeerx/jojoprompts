import { PAYMENT_STATES } from "./types.ts";

export function formatApiResponse({
  status,
  success,
  justCaptured,
  paymentId,
  paypal,
  transaction,
  subscription,
  subscriptionCreated,
  source,
  requestId,
  timestamp,
}: {
  status: string;
  success: boolean;
  justCaptured: boolean;
  paymentId: string | null;
  paypal: any;
  transaction: any;
  subscription: any;
  subscriptionCreated?: boolean;
  source: string;
  requestId: string;
  timestamp: string;
}) {
  const finalStatus = status || PAYMENT_STATES.UNKNOWN;
  const isSuccess = finalStatus === PAYMENT_STATES.COMPLETED;

  return {
    status: finalStatus,
    success: isSuccess,
    justCaptured,
    paymentId,
    paypal,
    transaction,
    subscription,
    subscriptionCreated,
    source,
    requestId,
    timestamp,
  };
}
