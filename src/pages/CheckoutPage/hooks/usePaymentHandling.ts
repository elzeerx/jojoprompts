
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
        planId: selectedPlan.id 
      }, user.id);
      
      // Standardize PayPal payment data structure
      const standardizedPaymentData = {
        paymentId: paymentData.paymentId || paymentData.payment_id || paymentData.id,
        paymentMethod: paymentData.paymentMethod || 'paypal',
        details: {
          id: paymentData.paymentId || paymentData.id,
          orderId: paymentData.orderId,
          status: paymentData.status,
          amount: paymentData.amount || paymentData.details?.amount
        }
      };

      const requestPayload = {
        planId: selectedPlan.id,
        userId: user.id,
        paymentData: standardizedPaymentData
      };

      logDebug("Sending request to create-subscription", "payment", { planId: selectedPlan.id }, user.id);

      // Enhanced timeout and retry logic
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Subscription creation timed out after 30 seconds")), 30000);
      });

      const functionPromise = supabase.functions.invoke("create-subscription", {
        body: requestPayload
      });

      console.log("Calling create-subscription edge function with payload:", requestPayload);
      const { data, error } = await Promise.race([functionPromise, timeoutPromise]) as any;

      console.log("create-subscription response:", { data, error });
      logDebug("Supabase function response received", "payment", { success: !!data?.success }, user.id);

      if (error) {
        logError("Supabase function error", "payment", { error: error.message }, user.id);
        throw new Error(`Payment processing failed: ${error.message || 'Unknown error'}`);
      }

      if (!data || !data.success) {
        logError("Function returned unsuccessful response", "payment", { dataExists: !!data, data }, user.id);
        throw new Error(data?.error || "Payment processing was unsuccessful");
      }

      logInfo("Plan access created successfully", "payment", undefined, user.id);

      toast({
        title: "Payment Successful!",
        description: "Your plan access has been activated successfully.",
      });

      navigate("/payment-success");

    } catch (error: any) {
      logError("Error creating plan access", "payment", { 
        error: error.message,
        errorType: error.name 
      }, user?.id);
      
      console.error("Payment processing error:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      // Provide more specific error messages
      let userMessage = "There was an issue processing your payment. Please try again.";
      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        userMessage = "Payment processing is taking longer than expected. Please check your account or contact support.";
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        userMessage = "Network connection issue. Please check your internet connection and try again.";
      } else if (errorMessage.includes("authentication")) {
        userMessage = "Authentication error. Please refresh the page and try again.";
      } else if (errorMessage.includes("unsuccessful")) {
        userMessage = "Payment was received but subscription setup failed. Please contact support.";
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
    
    // More specific error handling for PayPal
    let errorMessage = "There was an issue processing your PayPal payment. Please try again.";
    if (error?.message?.includes("network") || error?.message?.includes("fetch")) {
      errorMessage = "Network error. Please check your connection and try again.";
    } else if (error?.message?.includes("timeout")) {
      errorMessage = "Payment processing timed out. Please try again.";
    } else if (error?.message?.includes("cancelled")) {
      errorMessage = "Payment was cancelled. You can try again when ready.";
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
