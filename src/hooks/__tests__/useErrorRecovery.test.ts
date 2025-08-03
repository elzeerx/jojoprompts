import { renderHook, act } from '@testing-library/react';
import { setupTestEnvironment, createMockError, mockSafeLog } from '../../utils/testUtils';
import { 
  useErrorRecovery, 
  usePaymentErrorRecovery, 
  useNetworkErrorRecovery 
} from '../useErrorRecovery';

// Mock dependencies
jest.mock('../../utils/safeLogging', () => ({
  safeLog: mockSafeLog
}));

jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn()
}));

describe('Error Recovery Hooks', () => {
  setupTestEnvironment();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('useErrorRecovery', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useErrorRecovery());

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.attempt).toBe(0);
      expect(result.current.lastError).toBeNull();
      expect(result.current.hasExceededMaxRetries).toBe(false);
    });

    it('should execute operation successfully on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const { result } = renderHook(() => useErrorRecovery());

      let operationResult: any;
      await act(async () => {
        operationResult = await result.current.executeWithRetry(operation, 'test-operation');
      });

      expect(operationResult).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(result.current.isRetrying).toBe(false);
      expect(result.current.attempt).toBe(0);
      expect(result.current.lastError).toBeNull();
    });

    it('should retry failed operations', async () => {
      const error = createMockError('Operation failed');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const { result } = renderHook(() => useErrorRecovery({ maxRetries: 2 }));

      let operationResult: any;
      await act(async () => {
        operationResult = await result.current.executeWithRetry(operation, 'test-operation');
      });

      expect(operationResult).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(result.current.isRetrying).toBe(false);
      expect(result.current.attempt).toBe(0);
    });

    it('should handle max retries exceeded', async () => {
      const error = createMockError('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useErrorRecovery({ maxRetries: 2 }));

      let operationResult: any;
      await act(async () => {
        operationResult = await result.current.executeWithRetry(operation, 'test-operation');
      });

      expect(operationResult).toBeNull();
      expect(operation).toHaveBeenCalledTimes(2);
      expect(result.current.isRetrying).toBe(false);
      expect(result.current.attempt).toBe(2);
      expect(result.current.lastError).toEqual(error);
      expect(result.current.hasExceededMaxRetries).toBe(true);
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const error = createMockError('Operation failed');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const { result } = renderHook(() => useErrorRecovery({ onRetry }));

      await act(async () => {
        await result.current.executeWithRetry(operation, 'test-operation');
      });

      expect(onRetry).toHaveBeenCalledWith(1);
    });

    it('should call onMaxRetriesExceeded callback', async () => {
      const onMaxRetriesExceeded = jest.fn();
      const error = createMockError('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useErrorRecovery({ 
        maxRetries: 1, 
        onMaxRetriesExceeded 
      }));

      await act(async () => {
        await result.current.executeWithRetry(operation, 'test-operation');
      });

      expect(onMaxRetriesExceeded).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const error = createMockError('Network error');
      const operation = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useErrorRecovery());

      await act(async () => {
        await result.current.handleNetworkError(operation, 'api-call');
      });

      expect(mockSafeLog.error).toHaveBeenCalledWith('api-call failed on attempt 1:', {
        error: 'Network error',
        attempt: 1,
        maxRetries: 3,
        context: 'api-call'
      });
    });

    it('should handle payment errors', async () => {
      const error = createMockError('Payment error');
      const operation = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useErrorRecovery());

      await act(async () => {
        await result.current.handlePaymentError(operation, 'payment-processing');
      });

      expect(mockSafeLog.error).toHaveBeenCalledWith('payment-processing failed on attempt 1:', {
        error: 'Payment error',
        attempt: 1,
        maxRetries: 3,
        context: 'payment-processing'
      });
    });

    it('should reset retry state', () => {
      const { result } = renderHook(() => useErrorRecovery());

      act(() => {
        result.current.resetRetryState();
      });

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.attempt).toBe(0);
      expect(result.current.lastError).toBeNull();
    });

    it('should not retry if max retries already exceeded', async () => {
      const error = createMockError('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useErrorRecovery({ maxRetries: 1 }));

      // First attempt - fails
      await act(async () => {
        await result.current.executeWithRetry(operation, 'test-operation');
      });

      // Second attempt - should not retry
      const retryOperation = jest.fn().mockResolvedValue('success');
      await act(async () => {
        await result.current.retryLastOperation(retryOperation);
      });

      expect(retryOperation).not.toHaveBeenCalled();
      expect(mockSafeLog.warn).toHaveBeenCalledWith('Max retries already exceeded, not retrying');
    });
  });

  describe('usePaymentErrorRecovery', () => {
    it('should have payment-specific configuration', () => {
      const { result } = renderHook(() => usePaymentErrorRecovery());

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.attempt).toBe(0);
      expect(result.current.lastError).toBeNull();
    });

    it('should retry payment operations', async () => {
      const error = createMockError('Payment failed');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const { result } = renderHook(() => usePaymentErrorRecovery());

      let operationResult: any;
      await act(async () => {
        operationResult = await result.current.retryPayment(operation);
      });

      expect(operationResult).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should show payment-specific toast messages', async () => {
      const { toast } = require('@/hooks/use-toast');
      const error = createMockError('Payment failed');
      const operation = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() => usePaymentErrorRecovery());

      await act(async () => {
        await result.current.retryPayment(operation);
      });

      expect(toast).toHaveBeenCalledWith({
        title: 'Retrying Payment',
        description: 'Attempt 1/2 - Please wait...',
        variant: 'default'
      });

      expect(toast).toHaveBeenCalledWith({
        title: 'Payment Failed',
        description: 'Please contact support or try again later.',
        variant: 'destructive'
      });
    });
  });

  describe('useNetworkErrorRecovery', () => {
    it('should have network-specific configuration', () => {
      const { result } = renderHook(() => useNetworkErrorRecovery());

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.attempt).toBe(0);
      expect(result.current.lastError).toBeNull();
    });

    it('should retry network operations', async () => {
      const error = createMockError('Network failed');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const { result } = renderHook(() => useNetworkErrorRecovery());

      let operationResult: any;
      await act(async () => {
        operationResult = await result.current.retryNetworkOperation(operation);
      });

      expect(operationResult).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not show toast for network errors', async () => {
      const { toast } = require('@/hooks/use-toast');
      const error = createMockError('Network failed');
      const operation = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useNetworkErrorRecovery());

      await act(async () => {
        await result.current.retryNetworkOperation(operation);
      });

      // Should not show toast for network errors
      expect(toast).not.toHaveBeenCalled();
    });
  });

  describe('Error Recovery with Custom Options', () => {
    it('should respect custom maxRetries', async () => {
      const error = createMockError('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useErrorRecovery({ maxRetries: 5 }));

      await act(async () => {
        await result.current.executeWithRetry(operation, 'test-operation');
      });

      expect(operation).toHaveBeenCalledTimes(5);
    });

    it('should respect custom retryDelay', async () => {
      const error = createMockError('Operation failed');
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const { result } = renderHook(() => useErrorRecovery({ retryDelay: 500 }));

      await act(async () => {
        await result.current.executeWithRetry(operation, 'test-operation');
      });

      // Should have waited 500ms between retries
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not show toast when showToast is false', async () => {
      const { toast } = require('@/hooks/use-toast');
      const error = createMockError('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      const { result } = renderHook(() => useErrorRecovery({ showToast: false }));

      await act(async () => {
        await result.current.executeWithRetry(operation, 'test-operation');
      });

      expect(toast).not.toHaveBeenCalled();
    });
  });
}); 