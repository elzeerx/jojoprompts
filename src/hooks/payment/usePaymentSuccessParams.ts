
import { useSearchParams } from "react-router-dom";
import { useMemo } from "react";

export interface PaymentSuccessParams {
  planId: string | null;
  userId: string | null;  
  paymentId?: string | null;
  orderId?: string | null;
  token?: string | null;
  payerId?: string | null;
  debugObject?: Record<string, string>;
}

export function usePaymentSuccessParams(): PaymentSuccessParams {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    
    // Extract PayPal params
    const token = searchParams.get("token") || searchParams.get("orderId") || searchParams.get("order_id");
    const payerId = searchParams.get("PayerID") || searchParams.get("payer_id");
    const paymentId = searchParams.get("paymentId") || searchParams.get("payment_id");
    const orderId = searchParams.get("orderId") || searchParams.get("order_id");
    
    return {
      planId: searchParams.get("planId"),
      userId: searchParams.get("userId"),
      paymentId,
      orderId,
      token,
      payerId,
      debugObject: allParams,
    };
  }, [searchParams]);
}
