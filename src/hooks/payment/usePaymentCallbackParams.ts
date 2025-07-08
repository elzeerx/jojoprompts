
import { useSearchParams } from "react-router-dom";
import { useMemo } from "react";

export function usePaymentCallbackParams() {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });

    // Enhanced parameter extraction with multiple fallback mechanisms
    const success = searchParams.get('success');
    
    // Multiple possible parameter names for payment ID with better prioritization
    const paymentId = searchParams.get('paymentId') || 
                      searchParams.get('payment_id') || 
                      searchParams.get('paypal_payment_id') ||
                      searchParams.get('capture_id');
    
    // Multiple possible parameter names for payer ID
    const payerId = searchParams.get('PayerID') || 
                    searchParams.get('payer_id') || 
                    searchParams.get('PAYERID');
    
    // Order ID can come as token or order_id with better prioritization
    const orderId = searchParams.get('token') || 
                    searchParams.get('order_id') || 
                    searchParams.get('orderId') ||
                    searchParams.get('paypal_order_id');
    
    // Direct parameter extraction with enhanced localStorage fallback
    let planId = searchParams.get('plan_id') || searchParams.get('planId');
    let userId = searchParams.get('user_id') || searchParams.get('userId');

    // Enhanced localStorage fallback with validation and cleanup
    if (!planId || !userId) {
      try {
        const pendingPayment = localStorage.getItem('pending_payment');
        if (pendingPayment) {
          const parsed = JSON.parse(pendingPayment);
          console.log('Retrieved payment context from localStorage:', parsed);
          
          // Validate the stored data is recent (within last hour)
          const storedTime = parsed.timestamp;
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          
          if (storedTime && storedTime > oneHourAgo) {
            if (!planId && parsed.planId) planId = parsed.planId;
            if (!userId && parsed.userId) userId = parsed.userId;
          } else {
            console.log('Stored payment context is too old, ignoring');
            // Clean up old localStorage entry
            localStorage.removeItem('pending_payment');
          }
        }
      } catch (error) {
        console.error('Error retrieving payment context from localStorage:', error);
        // Clean up corrupted localStorage entry
        localStorage.removeItem('pending_payment');
      }
    }

    // Enhanced session-independent data validation
    const hasSessionIndependentData = !!(
      orderId && 
      (planId || userId) && 
      (success === 'true' || paymentId)
    );

    // Enhanced URL validation for payment flow integrity
    const isValidPaymentCallback = !!(
      (orderId || paymentId) && 
      (success !== null) &&
      (planId || userId)
    );

    // Enhanced debug object with better categorization
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
      validation: {
        hasSessionIndependentData,
        isValidPaymentCallback,
        hasRequiredPaymentId: !!(orderId || paymentId),
        hasUserContext: !!(planId || userId),
        hasSuccessIndicator: success !== null
      },
      url: window.location.href,
      hasLocalStorageFallback: !!(searchParams.get('plan_id') || searchParams.get('user_id')) ? false : !!(planId || userId),
      canProceedWithoutSession: hasSessionIndependentData,
      timestamp: Date.now()
    };

    console.log('Enhanced payment callback parameters extracted:', debugObject);

    // Clean up localStorage if we have all required params from URL
    if (searchParams.get('plan_id') && searchParams.get('user_id')) {
      try {
        localStorage.removeItem('pending_payment');
        console.log('Cleaned up localStorage after successful parameter extraction');
      } catch (error) {
        console.error('Error cleaning up localStorage:', error);
      }
    }

    return { 
      success, 
      paymentId, 
      payerId, 
      orderId, 
      planId, 
      userId, 
      debugObject,
      hasSessionIndependentData,
      isValidPaymentCallback
    };
  }, [searchParams]);
}
