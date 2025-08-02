/**
 * Custom hook for managing async operations with loading, error, and data states
 * Replaces scattered useState/useEffect patterns
 */

import { useState, useCallback } from 'react';
import { logger } from '@/utils/logger';
import { AsyncAction } from '@/types/common';

export interface UseAsyncActionOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  context?: string;
  autoReset?: boolean;
  resetDelay?: number;
}

export function useAsyncAction<T = any>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncActionOptions = {}
): AsyncAction<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const {
    onSuccess,
    onError,
    context = 'AsyncAction',
    autoReset = false,
    resetDelay = 3000
  } = options;

  const execute = useCallback(async (...args: any[]): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      logger.debug('Executing async action', context, { args });
      
      const result = await asyncFunction(...args);
      
      setData(result);
      logger.debug('Async action completed successfully', context, { result });
      
      if (onSuccess) {
        onSuccess(result);
      }

      if (autoReset) {
        setTimeout(() => {
          reset();
        }, resetDelay);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      logger.error('Async action failed', context, { 
        error: errorMessage,
        args,
        stack: err instanceof Error ? err.stack : undefined
      });
      
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [asyncFunction, onSuccess, onError, context, autoReset, resetDelay]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
    logger.debug('Reset async action state', context);
  }, [context]);

  return {
    loading,
    error,
    data,
    execute,
    reset
  };
}

// Specialized hooks for common patterns

export function useApiCall<T = any>(
  apiFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncActionOptions = {}
) {
  return useAsyncAction(apiFunction, {
    ...options,
    context: options.context || 'API_CALL'
  });
}

export function useFormSubmission<T = any>(
  submitFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncActionOptions = {}
) {
  return useAsyncAction(submitFunction, {
    ...options,
    context: options.context || 'FORM_SUBMISSION',
    autoReset: true,
    resetDelay: 2000
  });
}

export function useDataFetch<T = any>(
  fetchFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncActionOptions = {}
) {
  return useAsyncAction(fetchFunction, {
    ...options,
    context: options.context || 'DATA_FETCH'
  });
}