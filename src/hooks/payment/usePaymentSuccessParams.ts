
import { useSearchParams } from "react-router-dom";
import { useMemo } from "react";

export function usePaymentSuccessParams() {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    // Extract PayPal params only
    const token = searchParams.get("token") || searchParams.get("orderId") || searchParams.get("order_id");
    const payerId = searchParams.get("PayerID") || searchParams.get("payer_id");
    return {
      planId: searchParams.get("planId"),
      userId: searchParams.get("userId"),
      token,
      payerId,
      allParams,
    };
  }, [searchParams]);
}
