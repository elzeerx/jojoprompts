import { useSearchParams } from "react-router-dom";
import { useMemo, useEffect } from "react";

export interface PaymentParams {
  planId: string | null;
  userId: string | null;  
  paymentId?: string | null;
  orderId?: string | null;
  token?: string | null;
  payerId?: string | null;
  success?: boolean;
  hasSessionIndependentData?: boolean;
  isValidPaymentCallback?: boolean;
  debugObject?: Record<string, string>;
}

/**
 * Unified hook for extracting and validating all payment-related parameters
 * Consolidates functionality from usePaymentCallbackParams and usePaymentSuccessParams
 */
export function usePaymentParams(): PaymentParams {
  const [searchParams] = useSearchParams();

  // Session preservation effect
  useEffect(() => {
    const planId = searchParams.get("planId");
    const userId = searchParams.get("userId");
    const orderId = searchParams.get("orderId") || searchParams.get("order_id");
    
    if (planId || userId || orderId) {
      const preservationData = { planId, userId, orderId };
      sessionStorage.setItem('payment_callback_preservation', JSON.stringify(preservationData));
    }
  }, [searchParams]);

  return useMemo(() => {
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    
    // Extract core payment parameters with multiple fallback strategies
    const getParam = (keys: string[]) => {
      for (const key of keys) {
        const value = searchParams.get(key);
        if (value) return value;
      }
      return null;
    };

    // Fallback to session storage if URL params are missing
    const getParamWithFallback = (keys: string[], sessionKey?: string) => {
      const urlValue = getParam(keys);
      if (urlValue) return urlValue;
      
      if (sessionKey) {
        try {
          const preserved = JSON.parse(sessionStorage.getItem('payment_callback_preservation') || '{}');
          if (preserved[sessionKey]) return preserved[sessionKey];
        } catch {}
      }
      
      return null;
    };

    const token = getParam(["token", "orderId", "order_id"]);
    const payerId = getParam(["PayerID", "payer_id"]);
    const paymentId = getParam(["paymentId", "payment_id"]);
    const orderId = getParam(["orderId", "order_id"]);
    const planId = getParamWithFallback(["planId", "plan_id"], "planId");
    const userId = getParamWithFallback(["userId", "user_id"], "userId");
    const success = searchParams.get("success") === "true" || 
                   searchParams.get("payment_status") === "success";

    // Validation flags
    const hasSessionIndependentData = !!(token || payerId || paymentId || orderId);
    const isValidPaymentCallback = hasSessionIndependentData && !!(planId || userId);

    // Clean up preservation data if we have URL params
    if (hasSessionIndependentData && (planId || userId)) {
      sessionStorage.removeItem('payment_callback_preservation');
      localStorage.removeItem('pending_payment');
    }

    return {
      planId,
      userId,
      paymentId,
      orderId,
      token,
      payerId,
      success,
      hasSessionIndependentData,
      isValidPaymentCallback,
      debugObject: {
        ...allParams,
        hasSessionIndependentData: String(hasSessionIndependentData),
        isValidPaymentCallback: String(isValidPaymentCallback),
        fallbackUsed: String(!getParam(["planId", "userId"]) && !!(planId || userId))
      },
    };
  }, [searchParams]);
}