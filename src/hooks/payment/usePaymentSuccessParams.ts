
import { useSearchParams } from "react-router-dom";
import { useMemo } from "react";

export function usePaymentSuccessParams() {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    // Extract PayPal params and payment ID
    const token = searchParams.get("token") || searchParams.get("orderId") || searchParams.get("order_id");
    const payerId = searchParams.get("PayerID") || searchParams.get("payer_id");
    const paymentId = searchParams.get("paymentId") || searchParams.get("payment_id") || token; // Fallback to token if no specific paymentId
    
    return {
      planId: searchParams.get("planId"),
      userId: searchParams.get("userId"),
      token,
      payerId,
      paymentId,
      allParams,
    };
  }, [searchParams]);
}
