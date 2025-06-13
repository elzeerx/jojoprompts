
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { logInfo, logWarn, logError, logDebug } from '@/utils/secureLogging';

export function usePaymentHandling(user: any, selectedPlan: any, processing: boolean, setProcessing: any) {
  const navigate = useNavigate();

  const handlePaymentSuccess = useCallback(async (paymentData: any) => {
    if (processing) {
      logWarn("Payment already processing, ignoring duplicate call", "payment", undefined, user?.id);
      return;
    }
    
    if (!user?.id) {
      logError("User not authenticated during payment success", "payment");
      toast({
        title: "Authentication Error",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }
    
    setProcessing(true);
    
    try {
      logInfo("Processing PayPal payment success", "payment", { 
        paymentMethod: paymentData.paymentMethod || 'paypal',
        planId: selectedPlan.id,
        paymentId: paymentData.paymentId,
        status: paymentData.status
      }, user.id);
      
      console.log('Payment success received:', paymentData);

      // Since the capture function already handled subscription creation,
      // we just need to show success and redirect
      if (paymentData.status === 'COMPLETED') {
        logInfo("Payment completed successfully", "payment", { 
          paymentId: paymentData.paymentId 
        }, user.id);

        toast({
          title: "Payment Successful!",
          description: "Your subscription has been activated successfully.",
        });

        // Redirect to success page
        navigate("/payment-success");
      } else {
        logWarn("Payment not completed", "payment", { 
          status: paymentData.status 
        }, user.id);
        
        throw new Error(`Payment status is ${paymentData.status}, expected COMPLETED`);
      }

    } catch (error: any) {
      logError("Error processing payment success", "payment", { 
        error: error.message,
        errorType: error.name 
      }, user?.id);
      
      console.error("Payment processing error:", error);
      
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
    console.error("PayPal payment error occurred:", error);
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
  }, [user?.id, setProcessing]);

  return {
    handlePaymentSuccess,
    handlePaymentError
  };
}
