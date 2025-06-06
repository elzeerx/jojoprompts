
import { useState, useCallback } from 'react';

interface PaymentState {
  selectedMethod: 'paypal' | 'tap' | null;
  loading: boolean;
  processing: boolean;
  error: string | null;
  retryCount: number;
}

interface PaymentStateActions {
  setSelectedMethod: (method: 'paypal' | 'tap' | null) => void;
  setLoading: (loading: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  incrementRetry: () => void;
  resetState: () => void;
  canRetry: boolean;
}

const initialState: PaymentState = {
  selectedMethod: null,
  loading: false,
  processing: false,
  error: null,
  retryCount: 0
};

const MAX_RETRIES = 3;

export function useUnifiedPaymentState(): PaymentState & PaymentStateActions {
  const [state, setState] = useState<PaymentState>(initialState);

  const setSelectedMethod = useCallback((method: 'paypal' | 'tap' | null) => {
    setState(prev => ({ ...prev, selectedMethod: method, error: null, retryCount: 0 }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  const setProcessing = useCallback((processing: boolean) => {
    setState(prev => ({ ...prev, processing }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error, loading: false, processing: false }));
  }, []);

  const incrementRetry = useCallback(() => {
    setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  const canRetry = state.retryCount < MAX_RETRIES;

  return {
    ...state,
    setSelectedMethod,
    setLoading,
    setProcessing,
    setError,
    incrementRetry,
    resetState,
    canRetry
  };
}
