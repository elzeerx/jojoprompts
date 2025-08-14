
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePaymentCallbackParams } from "@/hooks/payment/usePaymentCallbackParams";
import { PaymentProcessingError } from "@/components/payment/PaymentProcessingError";
import { PaymentProcessingLoader } from "@/components/payment/PaymentProcessingLoader";
import { SessionManager } from "@/hooks/payment/helpers/sessionManager";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/utils/safeLogging";

export default function PaymentCallbackPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [sessionRestored, setSessionRestored] = useState(false);
  const [restorationAttempted, setRestorationAttempted] = useState(false);
  
  const { 
    success, 
    paymentId, 
    payerId, 
    orderId, 
    planId, 
    userId, 
    debugObject,
    hasSessionIndependentData
  } = usePaymentCallbackParams();

  // Enhanced status management
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const MAX_POLLS = 30;

  // Enhanced session restoration on callback
  useEffect(() => {
    const handleSessionRestoration = async () => {
      if (restorationAttempted) return;
      setRestorationAttempted(true);
      
      safeLog.debug('PaymentCallbackPage: Starting session restoration process', {
        hasUser: !!user,
        authLoading,
        hasBackup: SessionManager.hasBackup(),
        hasAnyData: SessionManager.hasAnyRecoveryData()
      });

      // If we don't have a user but we have session backup data, try to restore
      if (!user && !authLoading && SessionManager.hasAnyRecoveryData()) {
        safeLog.debug('PaymentCallbackPage: Attempting session restoration...');
        
        const result = await SessionManager.restoreSession();
        if (result.success) {
          safeLog.debug('PaymentCallbackPage: Session restoration successful');
          setSessionRestored(true);
          // Give Supabase time to update auth state
          setTimeout(() => {
            window.location.reload();
          }, 1000);
          return;
        } else {
          safeLog.warn('PaymentCallbackPage: Session restoration failed');
        }
      }
      
      // If we have payment parameters but no user, try fallback data
      if (!user && !authLoading && (planId || userId || orderId)) {
        const fallbackData = SessionManager.getFallbackData();
        const contextData = SessionManager.getPaymentContext();
        
        if (fallbackData || contextData) {
          safeLog.debug('PaymentCallbackPage: Using fallback payment data for completion');
          // Continue with payment processing using available data
        }
      }
    };

    if (!restorationAttempted) {
      handleSessionRestoration();
    }
  }, [user, authLoading, restorationAttempted]);

  // Auto-capture for approved orders with enhanced error handling
  useEffect(() => {
    const attemptAutoCapture = async () => {
      // Only proceed if we have the necessary data
      if (!success || !orderId || paymentId) {
        return;
      }

      // Use fallback data if user session is not available
      let captureUserId = userId;
      let capturePlanId = planId;
      
      if (!captureUserId || !capturePlanId) {
        const fallbackData = SessionManager.getFallbackData();
        const contextData = SessionManager.getPaymentContext();
        
        captureUserId = captureUserId || fallbackData?.userId || contextData?.userId;
        capturePlanId = capturePlanId || fallbackData?.planId || contextData?.planId;
      }

      if (!captureUserId || !capturePlanId) {
        safeLog.error('PaymentCallbackPage: Missing required data for auto-capture', {
          userId: captureUserId,
          planId: capturePlanId,
          orderId
        });
        setError('Missing payment information. Please contact support.');
        return;
      }

      safeLog.debug('PaymentCallbackPage: Attempting auto-capture', {
        orderId,
        userId: captureUserId,
        planId: capturePlanId
      });

      try {
        setStatus('capturing');
        
        const { data, error: captureError } = await supabase.functions.invoke('process-paypal-payment', {
          body: {
            action: 'capture',
            orderId,
            planId: capturePlanId,
            userId: captureUserId
          }
        });

        if (data?.success) {
          safeLog.debug('PaymentCallbackPage: Auto-capture successful', data);
          setStatus('completed');
          
          // Navigate to success page with proper parameters
          const successParams = new URLSearchParams({
            planId: capturePlanId,
            userId: captureUserId,
            paymentId: data.paymentId || orderId,
            status: 'completed',
            method: 'paypal'
          });
          
          setTimeout(() => {
            navigate(`/payment-success?${successParams.toString()}`);
          }, 1500);
        } else {
          safeLog.error('PaymentCallbackPage: Auto-capture failed', { error: captureError, data });
          
          // Enhanced error handling - still show success if we have payment completion data
          if (data?.paymentId || data?.transactionId) {
            safeLog.debug('PaymentCallbackPage: Capture failed but payment data exists, showing success');
            const successParams = new URLSearchParams({
              planId: capturePlanId,
              userId: captureUserId,
              paymentId: data.paymentId || data.transactionId || orderId,
              status: 'completed',
              method: 'paypal',
              auth_required: 'true' // Indicate auth may be required
            });
            
            setTimeout(() => {
              navigate(`/payment-success?${successParams.toString()}`);
            }, 1500);
          } else {
            setError('Payment capture failed. Please contact support.');
            setStatus('failed');
          }
        }
      } catch (err: any) {
        safeLog.error('PaymentCallbackPage: Auto-capture error', err);
        setError(`Payment processing error: ${err.message || 'Unknown error'}`);
        setStatus('failed');
      }
    };

    // Only attempt auto-capture if we haven't started processing yet
    if (status === 'processing' && success && orderId && !paymentId) {
      attemptAutoCapture();
    }
  }, [success, orderId, paymentId, planId, userId, status, navigate]);

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
