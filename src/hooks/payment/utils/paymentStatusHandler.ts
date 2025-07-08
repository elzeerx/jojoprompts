
import { useNavigate } from "react-router-dom";
import { PROCESSING_STATES } from "../constants/paymentProcessingConstants";
import { logError } from "@/utils/secureLogging";

/**
 * Handles payment status and redirects accordingly
 */
export function usePaymentStatusHandler({
  setStatus,
  setError,
  navigate,
  planId,
  userId,
  paymentId
}: {
  setStatus: (status: string) => void;
  setError: (error: string | null) => void;
  navigate: any;
  planId: string | null;
  userId: string | null;
  paymentId?: string;
}) {
  return (paymentStatus: string, paymentIdForSuccess?: string, contextUserId?: string, contextPlanId?: string) => {
    const finalUserId = contextUserId || userId;
    const finalPlanId = contextPlanId || planId;
    const finalPaymentId = paymentIdForSuccess || paymentId;

    if (paymentStatus === PROCESSING_STATES.COMPLETED) {
      const successParams = new URLSearchParams();
      if (finalPlanId) successParams.append('planId', finalPlanId);
      if (finalUserId) successParams.append('userId', finalUserId);
      if (finalPaymentId) successParams.append('payment_id', finalPaymentId);
      navigate(`/payment-success?${successParams.toString()}`);
    } else if ([PROCESSING_STATES.FAILED, PROCESSING_STATES.CANCELLED, 'DECLINED', 'VOIDED'].includes(paymentStatus)) {
      const failedParams = new URLSearchParams();
      if (finalPlanId) failedParams.append('planId', finalPlanId);
      failedParams.append('reason', `Payment ${paymentStatus.toLowerCase()}`);
      failedParams.append('status', paymentStatus);
      if (finalPaymentId) failedParams.append('payment_id', finalPaymentId);

      logError('Payment flow failed', 'PaymentCallbackPage', { paymentStatus });
      navigate(`/payment-failed?${failedParams.toString()}`);
    }
  };
}
