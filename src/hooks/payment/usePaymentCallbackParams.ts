
import { useSearchParams } from "react-router-dom";
import { useMemo } from "react";

export function usePaymentCallbackParams() {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });

    const success = searchParams.get('success');
    const paymentId = searchParams.get('paymentId') || searchParams.get('payment_id');
    const payerId = searchParams.get('PayerID') || searchParams.get('payer_id');
    const orderId = searchParams.get('token') || searchParams.get('order_id');
    const planId = searchParams.get('plan_id');
    const userId = searchParams.get('user_id');

    const debugObject = {
      rawParams: allParams,
      paymentId,
      payerId,
      orderId,
      planId,
      userId,
      url: window.location.href
    };

    return { success, paymentId, payerId, orderId, planId, userId, debugObject };
  }, [searchParams]);
}

