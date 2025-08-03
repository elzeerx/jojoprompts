import { useState, useCallback, useRef } from 'react';
import { safeLog } from '@/utils/safeLogging';
import { toast } from '@/hooks/use-toast';

interface ErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number) => void;
  onMaxRetriesExceeded?: () => void;
  showToast?: boolean;
}

interface RetryState {
  isRetrying: boolean;
  attempt: number;
  lastError: Error | null;
}

export function useErrorRecovery(options: ErrorRecoveryOptions = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry,
    onMaxRetriesExceeded,
    showToast = true
  } = options;

  const [retryState, setRetryState] = useState<RetryState>({
    isRetrying: false,
    attempt: 0,
    lastError: null
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetRetryState = useCallback(() => {
    setRetryState({
      isRetrying: false,
      attempt: 0,
      lastError: null
    });
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string = 'operation'
  ): Promise<T | null> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setRetryState(prev => ({
          ...prev,
          isRetrying: true,
          attempt
        }));

        safeLog.debug(`Attempting ${context} (attempt ${attempt}/${maxRetries})`);
        
        if (onRetry) {
          onRetry(attempt);
        }

        const result = await operation();
        
        // Success - reset retry state
        setRetryState({
          isRetrying: false,
          attempt: 0,
          lastError: null
        });

        safeLog.debug(`${context} completed successfully on attempt ${attempt}`);
        return result;

      } catch (error) {
        lastError = error as Error;
        
        safeLog.error(`${context} failed on attempt ${attempt}:`, {
          error: error.message,
          attempt,
          maxRetries,
          context
        });

        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => {
            retryTimeoutRef.current = setTimeout(resolve, retryDelay * attempt);
          });
        }
      }
    }

    // All retries failed
    setRetryState({
      isRetrying: false,
      attempt: maxRetries,
      lastError
    });

    if (showToast) {
      toast({
        title: "Operation Failed",
        description: `Failed after ${maxRetries} attempts. Please try again later.`,
        variant: "destructive"
      });
    }

    if (onMaxRetriesExceeded) {
      onMaxRetriesExceeded();
    }

    safeLog.error(`${context} failed after ${maxRetries} attempts:`, {
      error: lastError?.message,
      context
    });

    return null;
  }, [maxRetries, retryDelay, onRetry, onMaxRetriesExceeded, showToast]);

  const retryLastOperation = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    if (retryState.attempt >= maxRetries) {
      safeLog.warn('Max retries already exceeded, not retrying');
      return null;
    }

    return executeWithRetry(operation);
  }, [retryState.attempt, maxRetries, executeWithRetry]);

  const handleNetworkError = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string = 'network operation'
  ): Promise<T | null> => {
    return executeWithRetry(operation, context);
  }, [executeWithRetry]);

  const handlePaymentError = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string = 'payment operation'
  ): Promise<T | null> => {
    return executeWithRetry(operation, context);
  }, [executeWithRetry]);

  return {
    // State
    isRetrying: retryState.isRetrying,
    attempt: retryState.attempt,
    lastError: retryState.lastError,
    hasExceededMaxRetries: retryState.attempt >= maxRetries,

    // Actions
    executeWithRetry,
    retryLastOperation,
    handleNetworkError,
    handlePaymentError,
    resetRetryState
  };
}

// Specialized error recovery for specific contexts
export function usePaymentErrorRecovery() {
  const { executeWithRetry, ...retryState } = useErrorRecovery({
    maxRetries: 2,
    retryDelay: 2000,
    showToast: true,
    onRetry: (attempt) => {
      toast({
        title: "Retrying Payment",
        description: `Attempt ${attempt}/2 - Please wait...`,
        variant: "default"
      });
    },
    onMaxRetriesExceeded: () => {
      toast({
        title: "Payment Failed",
        description: "Please contact support or try again later.",
        variant: "destructive"
      });
    }
  });

  const retryPayment = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    return executeWithRetry(operation, 'payment');
  }, [executeWithRetry]);

  return {
    ...retryState,
    retryPayment
  };
}

export function useNetworkErrorRecovery() {
  const { executeWithRetry, ...retryState } = useErrorRecovery({
    maxRetries: 3,
    retryDelay: 1000,
    showToast: false,
    onRetry: (attempt) => {
      safeLog.debug(`Network retry attempt ${attempt}`);
    }
  });

  const retryNetworkOperation = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    return executeWithRetry(operation, 'network');
  }, [executeWithRetry]);

  return {
    ...retryState,
    retryNetworkOperation
  };
} 