
import { useState } from "react";

interface PaymentMethodErrors {
  paypal?: string;
  tap?: string;
}

interface PaymentMethodAvailability {
  paypal: boolean;
  tap: boolean;
}

interface PaymentRetryAttempts {
  paypal: number;
  tap: number;
}

export function usePaymentState() {
  const [processingMethod, setProcessingMethod] = useState<string | null>(null);
  const [methodErrors, setMethodErrors] = useState<PaymentMethodErrors>({});
  const [methodAvailable, setMethodAvailable] = useState<PaymentMethodAvailability>({
    paypal: true,
    tap: true
  });
  const [retryAttempts, setRetryAttempts] = useState<PaymentRetryAttempts>({
    paypal: 0,
    tap: 0
  });

  const maxRetryAttempts = 3;

  const logPaymentEvent = (event: string, method: string, data?: any) => {
    const logData = {
      event,
      method,
      timestamp: new Date().toISOString(),
      retryAttempts: retryAttempts[method as keyof typeof retryAttempts],
      ...data
    };
    console.log(`[Payment Container] ${event}:`, logData);
  };

  const getUserFriendlyErrorMessage = (error: any, method: string): string => {
    const methodName = method === 'paypal' ? 'PayPal' : 'Tap';
    
    if (error.message?.includes('network') || error.message?.includes('fetch')) {
      return `Network connection issue with ${methodName}. Please check your internet connection.`;
    }
    
    if (error.message?.includes('timeout')) {
      return `${methodName} is taking too long to respond. Please try again.`;
    }
    
    if (error.message?.includes('script') || error.message?.includes('load')) {
      return `${methodName} payment system failed to load. Please refresh the page and try again.`;
    }
    
    if (error.message?.includes('configuration') || error.message?.includes('config')) {
      return `${methodName} is temporarily unavailable due to configuration issues. Please try the other payment method.`;
    }
    
    if (error.message?.includes('authentication') || error.message?.includes('auth')) {
      return `Authentication error with ${methodName}. Please refresh the page and try again.`;
    }
    
    return `${methodName} encountered an issue. Please try again or use the alternative payment method.`;
  };

  const handlePaymentStart = (method: string) => {
    logPaymentEvent('Payment Started', method);
    setProcessingMethod(method);
    setMethodErrors(prev => ({
      ...prev,
      [method]: undefined
    }));
  };

  const handlePaymentSuccess = (paymentData: any) => {
    logPaymentEvent('Payment Success', paymentData.paymentMethod, {
      paymentId: paymentData.paymentId
    });
    setProcessingMethod(null);
    setMethodErrors({});
    setRetryAttempts({ paypal: 0, tap: 0 });
  };

  const handlePaymentError = (error: any, method: string) => {
    logPaymentEvent('Payment Error', method, {
      error: error.message || error,
      errorCode: error.code,
      attempt: retryAttempts[method as keyof typeof retryAttempts] + 1
    });
    
    setProcessingMethod(null);
    
    setRetryAttempts(prev => ({
      ...prev,
      [method]: prev[method as keyof typeof prev] + 1
    }));

    const userFriendlyMessage = getUserFriendlyErrorMessage(error, method);
    
    setMethodErrors(prev => ({
      ...prev,
      [method]: userFriendlyMessage
    }));

    if (error.critical || retryAttempts[method as keyof typeof retryAttempts] >= maxRetryAttempts) {
      setMethodAvailable(prev => ({
        ...prev,
        [method]: false
      }));
      logPaymentEvent('Payment Method Disabled', method, { 
        reason: error.critical ? 'Critical error' : 'Max retries exceeded' 
      });
    }
  };

  const handleMethodUnavailable = (method: string, reason: string) => {
    logPaymentEvent('Payment Method Unavailable', method, { reason });
    setMethodAvailable(prev => ({
      ...prev,
      [method]: false
    }));
    setMethodErrors(prev => ({
      ...prev,
      [method]: `${method === 'paypal' ? 'PayPal' : 'Tap'} is currently unavailable: ${reason}`
    }));
  };

  const handleRetryMethod = (method: string) => {
    if (retryAttempts[method as keyof typeof retryAttempts] >= maxRetryAttempts) {
      return;
    }

    logPaymentEvent('Manual Retry Initiated', method, { 
      attempt: retryAttempts[method as keyof typeof retryAttempts] + 1 
    });
    
    setMethodErrors(prev => ({
      ...prev,
      [method]: undefined
    }));
    
    setMethodAvailable(prev => ({
      ...prev,
      [method]: true
    }));
  };

  return {
    processingMethod,
    methodErrors,
    methodAvailable,
    retryAttempts,
    maxRetryAttempts,
    handlePaymentStart,
    handlePaymentSuccess,
    handlePaymentError,
    handleMethodUnavailable,
    handleRetryMethod,
    bothMethodsUnavailable: !methodAvailable.paypal && !methodAvailable.tap,
    hasAnyErrors: methodErrors.paypal || methodErrors.tap
  };
}
