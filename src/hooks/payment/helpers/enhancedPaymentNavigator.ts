
import { NavigateFunction } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface NavigationContext {
  navigate: NavigateFunction;
  userId?: string;
  planId?: string;
  orderId?: string;
  paymentId?: string;
}

export class EnhancedPaymentNavigator {
  static navigateBasedOnPaymentState(
    context: NavigationContext,
    verificationResult: {
      isSuccessful: boolean;
      hasActiveSubscription: boolean;
      needsAuthentication: boolean;
      subscription?: any;
      transaction?: any;
      errorMessage?: string;
    }
  ) {
    const { navigate, userId, planId, orderId, paymentId } = context;
    const { isSuccessful, hasActiveSubscription, needsAuthentication, errorMessage } = verificationResult;

    console.log('Navigating based on payment state:', {
      isSuccessful,
      hasActiveSubscription,
      needsAuthentication,
      errorMessage
    });

    if (isSuccessful && hasActiveSubscription) {
      // Success case - payment completed and subscription active
      const successParams = new URLSearchParams();
      if (planId) successParams.append('planId', planId);
      if (userId) successParams.append('userId', userId);
      if (paymentId) successParams.append('payment_id', paymentId);
      if (orderId) successParams.append('order_id', orderId);

      toast({
        title: "Payment successful!",
        description: "Your subscription is now active. Redirecting to your dashboard.",
      });

      navigate(`/payment-success?${successParams.toString()}`);
    } else if (isSuccessful && needsAuthentication) {
      // Payment succeeded but user needs to authenticate
      const successParams = new URLSearchParams();
      if (planId) successParams.append('planId', planId);
      if (paymentId) successParams.append('payment_id', paymentId);
      if (orderId) successParams.append('order_id', orderId);
      successParams.append('auth_required', 'true');

      toast({
        title: "Payment successful!",
        description: "Please log in to access your subscription.",
      });

      navigate(`/payment-success?${successParams.toString()}`);
    } else {
      // Failure case
      const failedParams = new URLSearchParams();
      if (planId) failedParams.append('planId', planId);
      failedParams.append('reason', errorMessage || 'Payment verification failed');
      failedParams.append('status', 'FAILED');
      if (paymentId) failedParams.append('payment_id', paymentId);
      if (orderId) failedParams.append('order_id', orderId);

      navigate(`/payment-failed?${failedParams.toString()}`);
    }
  }
}
