
import { useState, useCallback } from 'react';
import { PaymentErrorRecovery, PaymentError } from '@/utils/paymentErrorRecovery';

interface PaymentErrorState {
  error: PaymentError | null;
  retryCount: number;
  isRetrying: boolean;
}

export function usePaymentErrorRecovery() {
  const [errorState, setErrorState] = useState<PaymentErrorState>({
    error: null,
    retryCount: 0,
    isRetrying: false
  });

  const handleError = useCallback((error: any, method: string) => {
    const analyzedError = PaymentErrorRecovery.analyzeError(error, method);
    
    setErrorState(prev => ({
      error: analyzedError,
      retryCount: prev.retryCount + 1,
      isRetrying: false
    }));

    return analyzedError;
  }, []);

  const retry = useCallback(async (retryFunction: () => Promise<void>) => {
    if (!errorState.error) return;

    const shouldRetry = PaymentErrorRecovery.shouldAutoRetry(errorState.error, errorState.retryCount);
    
    if (!shouldRetry) {
      console.warn('Auto-retry not recommended for this error type');
      return;
    }

    setErrorState(prev => ({ ...prev, isRetrying: true }));

    const delay = PaymentErrorRecovery.getRetryDelay(errorState.retryCount);
    
    try {
      await new Promise(resolve => setTimeout(resolve, delay));
      await retryFunction();
      
      // Reset error state on successful retry
      setErrorState({
        error: null,
        retryCount: 0,
        isRetrying: false
      });
    } catch (retryError) {
      // Handle retry failure
      const newError = PaymentErrorRecovery.analyzeError(retryError, errorState.error.method || 'unknown');
      setErrorState(prev => ({
        error: newError,
        retryCount: prev.retryCount + 1,
        isRetrying: false
      }));
    }
  }, [errorState]);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      retryCount: 0,
      isRetrying: false
    });
  }, []);

  const getSuggestions = useCallback(() => {
    if (!errorState.error) return [];
    return PaymentErrorRecovery.getRecoverySuggestions(errorState.error);
  }, [errorState.error]);

  return {
    error: errorState.error,
    retryCount: errorState.retryCount,
    isRetrying: errorState.isRetrying,
    handleError,
    retry,
    clearError,
    getSuggestions,
    canRetry: errorState.error ? PaymentErrorRecovery.shouldAutoRetry(errorState.error, errorState.retryCount) : false
  };
}
