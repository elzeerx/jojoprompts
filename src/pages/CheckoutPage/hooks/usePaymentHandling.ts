
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { logInfo, logWarn, logError } from '@/utils/secureLogging';

export function usePaymentHandling(user: any, selectedPlan: any, processing: boolean, setProcessing: any) {
  const navigate = useNavigate();

  const handlePaymentSuccess = useCallback(async (paymentData: any) => {
    console.log('[Payment] Success handler called with:', paymentData);
    
    if (processing) {
      logWarn("Payment already processing, ignoring duplicate call", "payment", undefined, user?.id);
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

    // Validate payment data more thoroughly
    if (!paymentData) {
      console.error('[Payment] No payment data received');
      onError(new Error('No payment data received'));
      return;
    }

    if (!paymentData.paymentId && !paymentData.details?.id) {
      console.error('[Payment] Missing payment ID in success data:', paymentData);
      onError(new Error('Payment ID missing from success response'));
      return;
    }
    
    setProcessing(true);
    
    try {
      logInfo("Processing PayPal payment success", "payment", { 
        paymentMethod: paymentData.paymentMethod || 'paypal',
        planId: selectedPlan.id,
        paymentId: paymentData.paymentId || paymentData.details?.id,
        status: paymentData.status,
        orderId: paymentData.orderId
      }, user.id);
      
      console.log('[Payment] Payment processing successful, navigating to success page');

      // Since the capture function already handled subscription creation,
      // we just need to show success and redirect
      const paymentStatus = paymentData.status || paymentData.details?.status;
      
      if (paymentStatus === 'COMPLETED' || paymentStatus === 'completed') {
        logInfo("Payment completed successfully", "payment", { 
          paymentId: paymentData.paymentId || paymentData.details?.id 
        }, user.id);

        toast({
          title: "Payment Successful!",
          description: "Your subscription has been activated successfully.",
        });

        // Navigate to success page with payment details
        const successParams = new URLSearchParams({
          planId: selectedPlan.id,
          userId: user.id,
          paymentId: paymentData.paymentId || paymentData.details?.id,
          status: 'completed'
        });
        
        console.log('[Payment] Redirecting to success page with params:', successParams.toString());
        navigate(`/payment-success?${successParams.toString()}`);
      } else {
        console.warn('[Payment] Payment status not completed:', paymentStatus);
        logWarn("Payment not completed", "payment", { 
          status: paymentStatus 
        }, user.id);
        
        // Still consider it successful if we have a payment ID
        if (paymentData.paymentId || paymentData.details?.id) {
          toast({
            title: "Payment Received",
            description: "Your payment has been received and is being processed.",
          });
          
          const successParams = new URLSearchParams({
            planId: selectedPlan.id,
            userId: user.id,
            paymentId: paymentData.paymentId || paymentData.details?.id,
            status: 'processing'
          });
          
          navigate(`/payment-success?${successParams.toString()}`);
        } else {
          throw new Error(`Payment status is ${paymentStatus}, expected COMPLETED`);
        }
      }

    } catch (error: any) {
      console.error('[Payment] Error processing payment success:', error);
      logError("Error processing payment success", "payment", { 
        error: error.message,
        errorType: error.name 
      }, user?.id);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      let userMessage = "There was an issue processing your payment. Please contact support.";
      if (errorMessage.includes("COMPLETED")) {
        userMessage = "Payment received but subscription setup is pending. Please contact support if you don't see your subscription activated shortly.";
      } else if (errorMessage.includes("authentication")) {
        userMessage = "Authentication error. Please refresh the page and try again.";
      }
      
      toast({
        title: "Payment Processing Error",
        description: userMessage,
        variant: "destructive",
      });
      
    } finally {
      setProcessing(false);
    }
  }, [processing, selectedPlan, user, navigate, setProcessing]);

  const handlePaymentError = useCallback((error: any) => {
    console.error("[Payment] PayPal payment error occurred:", error);
    logError("PayPal payment error occurred", "payment", { error: error.message || error }, user?.id);
    setProcessing(false);
    
    let errorMessage = "There was an issue processing your PayPal payment. Please try again.";
    if (error?.message?.includes("network") || error?.message?.includes("fetch")) {
      errorMessage = "Network error. Please check your connection and try again.";
    } else if (error?.message?.includes("timeout")) {
      errorMessage = "Payment processing timed out. Please try again.";
    } else if (error?.message?.includes("cancelled")) {
      errorMessage = "Payment was cancelled. You can try again when ready.";
    } else if (error?.message?.includes("capture")) {
      errorMessage = "Payment approval succeeded but capture failed. Please contact support.";
    } else if (error?.message?.includes("PayPal")) {
      errorMessage = "PayPal service error. Please try again or contact support.";
    }
    
    toast({
      title: "Payment Failed",
      description: errorMessage,
      variant: "destructive",
    });

    // Navigate to failure page with proper error information
    const failureParams = new URLSearchParams({
      planId: selectedPlan?.id || '',
      reason: errorMessage
    });
    
    console.log('[Payment] Redirecting to failure page with params:', failureParams.toString());
    navigate(`/payment-failed?${failureParams.toString()}`);
  }, [user?.id, setProcessing, selectedPlan, navigate]);

  return {
    handlePaymentSuccess,
    handlePaymentError
  };
}
