
import { useSearchParams } from "react-router-dom";
import { useMemo, useEffect } from "react";
import { safeLog } from "@/utils/safeLogging";
import { SessionManager } from "./helpers/sessionManager";

export function usePaymentCallbackParams() {
  const [searchParams] = useSearchParams();

  // Effect to handle parameter preservation for session recovery
  useEffect(() => {
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });

    // If we have payment parameters, preserve them in case of session issues
    const planId = allParams.planId || allParams.plan_id;
    const userId = allParams.userId || allParams.user_id;
    const orderId = allParams.token || allParams.orderId || allParams.order_id;

    if (planId || userId || orderId) {
      try {
        const preservationData = {
          planId,
          userId,
          orderId,
          timestamp: Date.now(),
          source: 'payment_callback_url'
        };
        
        // Store in sessionStorage for this session only
        sessionStorage.setItem('payment_callback_preservation', JSON.stringify(preservationData));
        safeLog.debug('Payment callback params preserved for session recovery', preservationData);
      } catch (e) {
        safeLog.warn('Failed to preserve payment callback params', e);
      }
    }
  }, [searchParams]);

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

    // Enhanced fallback mechanism with multiple sources
    if (!planId || !userId) {
      try {
        // Try SessionManager payment context first
        const sessionContext = SessionManager.getPaymentContext();
        const fallbackData = SessionManager.getFallbackData();
        
        // Try preserved callback data
        const preservedData = sessionStorage.getItem('payment_callback_preservation');
        const preserved = preservedData ? JSON.parse(preservedData) : null;
        
        // Try legacy localStorage fallback
        const pendingPayment = localStorage.getItem('pending_payment');
        const legacy = pendingPayment ? JSON.parse(pendingPayment) : null;
        
        if (!planId) {
          planId = sessionContext?.planId || 
                  fallbackData?.planId || 
                  preserved?.planId || 
                  legacy?.planId;
          if (planId) {
            safeLog.debug('Payment Callback: Used fallback planId', { 
              planId, 
              source: sessionContext?.planId ? 'sessionContext' : 
                     fallbackData?.planId ? 'fallbackData' : 
                     preserved?.planId ? 'preserved' : 'legacy'
            });
          }
        }
        
        if (!userId) {
          userId = sessionContext?.userId || 
                  fallbackData?.userId || 
                  preserved?.userId || 
                  legacy?.userId;
          if (userId) {
            safeLog.debug('Payment Callback: Used fallback userId', { 
              userId, 
              source: sessionContext?.userId ? 'sessionContext' : 
                     fallbackData?.userId ? 'fallbackData' : 
                     preserved?.userId ? 'preserved' : 'legacy'
            });
          }
        }

        // Clean up legacy data if we found newer sources
        if (legacy && (sessionContext || fallbackData || preserved)) {
          localStorage.removeItem('pending_payment');
          safeLog.debug('Cleaned up legacy payment context data');
        }
      } catch (error) {
        safeLog.error('Error retrieving payment context from fallback sources:', error);
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

    // Enhanced debug object with recovery information
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
      recovery: {
        hasSessionManager: SessionManager.hasAnyRecoveryData(),
        hasPreservedData: !!sessionStorage.getItem('payment_callback_preservation'),
        hasLegacyFallback: !!localStorage.getItem('pending_payment'),
        restorationAttempts: SessionManager.getRestorationAttempts(),
        usedFallback: !!(searchParams.get('plan_id') || searchParams.get('user_id')) ? false : !!(planId || userId)
      },
      url: window.location.href,
      canProceedWithoutSession: hasSessionIndependentData,
      timestamp: Date.now()
    };

    safeLog.debug('Enhanced payment callback parameters extracted:', debugObject);

    // Clean up fallback data if we have all required params from URL
    if (searchParams.get('plan_id') && searchParams.get('user_id')) {
      try {
        localStorage.removeItem('pending_payment');
        sessionStorage.removeItem('payment_callback_preservation');
        safeLog.debug('Cleaned up fallback data after successful parameter extraction');
      } catch (error) {
        safeLog.error('Error cleaning up fallback data:', error);
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
