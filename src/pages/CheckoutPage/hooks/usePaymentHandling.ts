
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logInfo, logWarn, logError, logDebug } from '@/utils/secureLogging';
import { enhancedRateLimiter, EnhancedRateLimitConfigs } from '@/utils/enhancedRateLimiting';

export function usePaymentHandling(user: any, selectedPlan: any, processing: boolean, setProcessing: any) {
  const navigate = useNavigate();

  const handlePaymentSuccess = useCallback(async (paymentData: any) => {
    // Check rate limiting for payment attempts
    const paymentRateCheck = enhancedRateLimiter.isAllowed(
      `payment_${user?.id || 'anonymous'}`,
      EnhancedRateLimitConfigs.PAYMENT_ATTEMPT
    );

    if (!paymentRateCheck.allowed) {
      toast({
        title: "Too Many Payment Attempts",
        description: `Please wait ${paymentRateCheck.retryAfter} seconds before trying again.`,
        variant: "destructive",
      });
      return;
    }

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
      logInfo("Processing payment success", "payment", { 
        paymentMethod: paymentData.paymentMethod || (paymentData.source ? 'tap' : 'paypal'),
        planId: selectedPlan.id 
      }, user.id);
      
      // Standardize payment data structure
      const standardizedPaymentData = {
        paymentId: paymentData.paymentId || paymentData.payment_id || paymentData.id,
        paymentMethod: paymentData.paymentMethod || (paymentData.source ? 'tap' : 'paypal'),
        details: {
          id: paymentData.id || paymentData.paymentId,
          status: paymentData.status,
          amount: paymentData.amount
        }
      };

      const requestPayload = {
        planId: selectedPlan.id,
        userId: user.id,
        paymentData: standardizedPaymentData
      };

      logDebug("Sending request to create-subscription", "payment", { planId: selectedPlan.id }, user.id);

      // Create a timeout promise for manual timeout handling
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out after 30 seconds")), 30000);
      });

      // Race between the function call and timeout
      const functionPromise = supabase.functions.invoke("create-subscription", {
        body: requestPayload
      });

      const { data, error } = await Promise.race([functionPromise, timeoutPromise]) as any;

      logDebug("Supabase function response received", "payment", { success: !!data?.success }, user.id);

      if (error) {
        logError("Supabase function error", "payment", { error: error.message }, user.id);
        throw new Error(`Function error: ${error.message || JSON.stringify(error)}`);
      }

      if (!data || !data.success) {
        logError("Function returned unsuccessful response", "payment", { dataExists: !!data }, user.id);
        throw new Error(data?.error || "Function returned unsuccessful response");
      }

      logInfo("Plan access created successfully", "payment", undefined, user.id);

      toast({
        title: "Success!",
        description: "Your plan access has been activated",
      });

      navigate("/payment-success");

    } catch (error: any) {
      // Record failed payment attempt for rate limiting
      enhancedRateLimiter.recordFailedAttempt(
        `payment_${user?.id}`,
        { error: error.message, planId: selectedPlan?.id }
      );
      
      logError("Error creating plan access", "payment", { 
        error: error.message,
        errorType: error.name 
      }, user?.id);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      toast({
        title: "Payment Processing Error",
        description: `Failed to activate plan access: ${errorMessage}. Please contact support if this persists.`,
        variant: "destructive",
      });
      
    } finally {
      setProcessing(false);
    }
  }, [processing, selectedPlan, user, navigate, setProcessing]);

  const handlePaymentError = useCallback((error: any) => {
    logError("Payment error occurred", "payment", { error: error.message }, user?.id);
    setProcessing(false);
    toast({
      title: "Payment Failed",
      description: "There was an issue processing your payment. Please try again.",
      variant: "destructive",
    });
  }, [user?.id, setProcessing]);

  return {
    handlePaymentSuccess,
    handlePaymentError
  };
}
