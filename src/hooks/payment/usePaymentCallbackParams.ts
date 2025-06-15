
import { useSearchParams } from "react-router-dom";
import { useMemo } from "react";

export function usePaymentCallbackParams() {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });

    // ENHANCED: Better parameter extraction with fallback mechanisms
    const success = searchParams.get('success');
    
    // Multiple possible parameter names for payment ID
    const paymentId = searchParams.get('paymentId') || 
                      searchParams.get('payment_id') || 
                      searchParams.get('paypal_payment_id');
    
    // Multiple possible parameter names for payer ID
    const payerId = searchParams.get('PayerID') || 
                    searchParams.get('payer_id') || 
                    searchParams.get('PAYERID');
    
    // Order ID can come as token or order_id
    const orderId = searchParams.get('token') || 
                    searchParams.get('order_id') || 
                    searchParams.get('orderId');
    
    // Direct parameter extraction with localStorage fallback
    let planId = searchParams.get('plan_id') || searchParams.get('planId');
    let userId = searchParams.get('user_id') || searchParams.get('userId');

    // ENHANCED: Comprehensive fallback to localStorage if parameters are missing
    if (!planId || !userId) {
      try {
        const pendingPayment = localStorage.getItem('pending_payment');
        if (pendingPayment) {
          const parsed = JSON.parse(pendingPayment);
          console.log('Retrieved payment context from localStorage:', parsed);
          
          if (!planId && parsed.planId) planId = parsed.planId;
          if (!userId && parsed.userId) userId = parsed.userId;
        }
      } catch (error) {
        console.error('Error retrieving payment context from localStorage:', error);
      }
    }

    // SESSION-INDEPENDENT: Set flag to indicate if we have enough info to proceed without session
    const hasSessionIndependentData = !!(orderId && (planId || userId));

    const debugObject = {
      rawParams: allParams,
      extractedParams: {
        success,
        paymentId,
        payerId,
        orderId,
        planId,
        userId
      },
      url: window.location.href,
      hasLocalStorageFallback: !!(searchParams.get('plan_id') || searchParams.get('user_id')) ? false : !!(planId || userId),
      hasSessionIndependentData,
      canProceedWithoutSession: hasSessionIndependentData
    };

    console.log('Payment callback parameters extracted:', debugObject);

    return { 
      success, 
      paymentId, 
      payerId, 
      orderId, 
      planId, 
      userId, 
      debugObject,
      hasSessionIndependentData
    };
  }, [searchParams]);
}
