
import { useState, useEffect } from 'react';
import { usePayPalScriptLoader } from './usePayPalScriptLoader';
import { usePayPalButtonRenderer } from './usePayPalButtonRenderer';

interface PayPalPaymentConfig {
  amount: number;
  planName: string;
  onSuccess: (paymentData: any) => void;
  onError: (error: any) => void;
  onStart?: () => void;
  onUnavailable?: (reason: string) => void;
}

export function usePayPalPayment(config: PayPalPaymentConfig) {
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const {
    loading,
    error,
    ready,
    loadPayPalScript,
    cleanup,
    isComponentMounted,
    logPayPalEvent
  } = usePayPalScriptLoader();

  const {
    paypalRef,
    renderPayPalButton,
    clearButtonContainer
  } = usePayPalButtonRenderer();

  const handleRetry = () => {
    if (retryCount < maxRetries && isComponentMounted()) {
      logPayPalEvent('Retry Attempted', { attempt: retryCount + 1 });
      setRetryCount(prev => prev + 1);
      clearButtonContainer();
      loadPayPalScript(config.amount, config.planName, config.onUnavailable);
    }
  };

  useEffect(() => {
    loadPayPalScript(config.amount, config.planName, config.onUnavailable);
    return cleanup;
  }, []);

  useEffect(() => {
    if (ready && window.paypal && isComponentMounted()) {
      renderPayPalButton({
        amount: config.amount,
        planName: config.planName,
        onSuccess: config.onSuccess,
        onError: config.onError,
        onStart: config.onStart,
        logPayPalEvent,
        isComponentMounted
      });
    }
  }, [ready, config.amount, config.planName]);

  return {
    paypalRef,
    loading,
    error,
    retryCount,
    maxRetries,
    handleRetry
  };
}
