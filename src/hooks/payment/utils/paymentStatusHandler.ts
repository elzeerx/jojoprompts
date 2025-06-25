
import { useNavigate } from "react-router-dom";
import { PROCESSING_STATES } from "../constants/paymentProcessingConstants";
import { logError } from "@/utils/secureLogging";

/**
 * Handles payment status and redirects accordingly
 */
export function usePaymentStatusHandler({
  planId,
  userId,
  orderId,
  debugObject
}: {
  planId: string | null;
  userId: string | null;
  orderId: string | null;
  debugObject: any;
}) {
  const navigate = useNavigate();
  return (paymentStatus: string, paymentIdForSuccess?: string, contextUserId?: string, contextPlanId?: string) => {
    const finalUserId = contextUserId || userId;
    const finalPlanId = contextPlanId || planId;
    if (paymentStatus === PROCESSING_STATES.COMPLETED) {
      const successParams = new URLSearchParams();
      if (finalPlanId) successParams.append('planId', finalPlanId);
      if (finalUserId) successParams.append('userId', finalUserId);
      if (paymentIdForSuccess) successParams.append('payment_id', paymentIdForSuccess);
      if (orderId) successParams.append('order_id', orderId);
      navigate(`/payment-success?${successParams.toString()}`);
    } else if ([PROCESSING_STATES.FAILED, PROCESSING_STATES.CANCELLED, 'DECLINED', 'VOIDED'].includes(paymentStatus)) {
      const failedParams = new URLSearchParams();
      if (finalPlanId) failedParams.append('planId', finalPlanId);
      failedParams.append('reason', `Payment ${paymentStatus.toLowerCase()}`);
      failedParams.append('status', paymentStatus);
      if (paymentIdForSuccess) failedParams.append('payment_id', paymentIdForSuccess);

      logError('Payment flow failed', 'PaymentCallbackPage', { paymentStatus, debugObject });
      navigate(`/payment-failed?${failedParams.toString()}`);
    }
  };
}
