
import { useSearchParams } from "react-router-dom";
import { useMemo } from "react";

export function usePaymentSuccessParams() {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    return {
      planId: searchParams.get('planId'),
      userId: searchParams.get('userId'),
      tapId: searchParams.get('tap_id'),
      chargeStatus: searchParams.get('status'),
      responseCode: searchParams.get('response_code'),
      chargeId: searchParams.get('charge_id'),
      paymentResult: searchParams.get('payment_result'),
      paymentMethod: searchParams.get('payment_method'),
      allParams,
    };
  }, [searchParams]);
}
