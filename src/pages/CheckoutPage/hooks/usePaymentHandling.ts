
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { logInfo, logError } from '@/utils/secureLogging';

export function usePaymentHandling(user: any, selectedPlan: any, processing: boolean, setProcessing: any) {
  const navigate = useNavigate();

  const handlePaymentSuccess = useCallback(async (paymentData: any) => {
    console.log('[Payment] Success handler called with:', paymentData);
    
    if (processing) {
      console.warn('[Payment] Payment already processing, ignoring duplicate call');
      return;
    }
    
    if (!user?.id) {
      console.error('[Payment] User not authenticated during payment success');
      logError("User not authenticated during payment success", "payment");
      toast({
        title: "Authentication Error",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    if (!paymentData?.paymentId) {
      console.error('[Payment] No payment ID received');
      logError("No payment ID received in success handler", "payment", undefined, user?.id);
      toast({
        title: "Payment Processing Error",
        description: "Payment ID missing. Please contact support.",
        variant: "destructive",
      });
      return;
    }
    
    setProcessing(true);
    
    try {
      logInfo("Payment completed successfully", "payment", { 
        paymentId: paymentData.paymentId,
        transactionId: paymentData.transactionId,
        planId: selectedPlan.id
      }, user.id);

      console.log('[Payment] Navigating to success page');

      // Navigate to success page
      const successParams = new URLSearchParams({
        planId: selectedPlan.id,
        userId: user.id,
        paymentId: paymentData.paymentId,
        status: 'completed'
      });
      
      navigate(`/payment-success?${successParams.toString()}`);

    } catch (error: any) {
      console.error('[Payment] Error processing payment success:', error);
      logError("Error processing payment success", "payment", { 
        error: error.message 
      }, user?.id);
      
      toast({
        title: "Payment Processing Error",
        description: "There was an issue processing your payment. Please contact support.",
        variant: "destructive",
      });
      
    } finally {
      setProcessing(false);
    }
  }, [processing, selectedPlan, user, navigate, setProcessing]);

  const handlePaymentError = useCallback((error: any) => {
    console.error("[Payment] Payment error occurred:", error);
    logError("Payment error occurred", "payment", { error: error.message || error }, user?.id);
    setProcessing(false);
    
    let errorMessage = "Payment failed. Please try again.";
    if (error?.message?.includes("cancelled")) {
      errorMessage = "Payment was cancelled. You can try again when ready.";
    } else if (error?.message?.includes("network") || error?.message?.includes("fetch")) {
      errorMessage = "Network error. Please check your connection and try again.";
    }
    
    toast({
      title: "Payment Failed",
      description: errorMessage,
      variant: "destructive",
    });

    // Navigate to failure page
    const failureParams = new URLSearchParams({
      planId: selectedPlan?.id || '',
      reason: errorMessage
    });
    
    navigate(`/payment-failed?${failureParams.toString()}`);
  }, [user?.id, setProcessing, selectedPlan, navigate]);

  return {
    handlePaymentSuccess,
    handlePaymentError
  };
}
