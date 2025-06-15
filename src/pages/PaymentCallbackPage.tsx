
import { usePaymentCallbackParams } from "@/hooks/payment/usePaymentCallbackParams";
import { usePaymentProcessing } from "@/hooks/payment/usePaymentProcessing";
import { PaymentProcessingError } from "@/components/payment/PaymentProcessingError";
import { PaymentProcessingLoader } from "@/components/payment/PaymentProcessingLoader";

export default function PaymentCallbackPage() {
  const { success, paymentId, payerId, orderId, planId, userId, debugObject } = usePaymentCallbackParams();

  const {
    status,
    error,
    pollCount,
    MAX_POLLS
  } = usePaymentProcessing({
    success,
    paymentId,
    orderId,
    planId,
    userId,
    debugObject
  });

  if (error) {
    return <PaymentProcessingError error={error} debugInfo={debugObject} />;
  }

  return (
    <PaymentProcessingLoader
      status={status}
      pollCount={pollCount}
      maxPolls={MAX_POLLS}
      debugInfo={debugObject}
    />
  );
}
