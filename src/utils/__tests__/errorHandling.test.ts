import { render, screen, fireEvent } from '@testing-library/react';
import { setupTestEnvironment, createMockError, mockToast, mockSafeLog } from '../testUtils';
import { 
  handleError, 
  handleAuthError, 
  handleNetworkError, 
  handlePaymentError, 
  handleFavoriteError,
  withErrorHandling,
  handleValidationError,
  ERROR_MESSAGES 
} from '../errorHandling';

// Mock dependencies
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn()
}));

jest.mock('../safeLogging', () => ({
  safeLog: mockSafeLog
}));

jest.mock('../errorMonitoring', () => ({
  reportError: jest.fn(),
  reportPaymentError: jest.fn(),
  reportNetworkError: jest.fn(),
  reportAuthError: jest.fn(),
  ErrorSeverity: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  },
  ErrorCategory: {
    NETWORK: 'network',
    PAYMENT: 'payment',
    AUTHENTICATION: 'authentication',
    VALIDATION: 'validation',
    RENDERING: 'rendering',
    DATABASE: 'database',
    UNKNOWN: 'unknown'
  }
}));

describe('Error Handling Utilities', () => {
  setupTestEnvironment();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleError', () => {
    it('should handle generic errors correctly', () => {
      const error = createMockError('Test error');
      const result = handleError(error, 'test-context');

      expect(result).toBe(ERROR_MESSAGES.GENERIC_ERROR);
      expect(mockSafeLog.error).toHaveBeenCalledWith('Error in test-context:', {
        error: 'Test error',
        type: 'GENERIC_ERROR',
        context: 'test-context'
      });
    });

    it('should handle payment errors with high severity', () => {
      const error = createMockError('Payment failed');
      const result = handleError(error, 'payment-context', 'PAYMENT_FAILED');

      expect(result).toBe(ERROR_MESSAGES.PAYMENT_FAILED);
      expect(mockSafeLog.error).toHaveBeenCalledWith('Error in payment-context:', {
        error: 'Payment failed',
        type: 'PAYMENT_FAILED',
        context: 'payment-context'
      });
    });

    it('should handle authentication errors with medium severity', () => {
      const error = createMockError('Authentication required');
      const result = handleError(error, 'auth-context', 'AUTHENTICATION_REQUIRED');

      expect(result).toBe(ERROR_MESSAGES.AUTHENTICATION_REQUIRED);
      expect(mockSafeLog.error).toHaveBeenCalledWith('Error in auth-context:', {
        error: 'Authentication required',
        type: 'AUTHENTICATION_REQUIRED',
        context: 'auth-context'
      });
    });

    it('should not show toast when showToast is false', () => {
      const error = createMockError('Test error');
      handleError(error, 'test-context', 'GENERIC_ERROR', false);

      // Toast should not be called
      expect(mockSafeLog.error).toHaveBeenCalled();
    });

    it('should handle non-Error objects', () => {
      const error = 'String error';
      const result = handleError(error, 'test-context');

      expect(result).toBe(ERROR_MESSAGES.GENERIC_ERROR);
      expect(mockSafeLog.error).toHaveBeenCalledWith('Error in test-context:', {
        error: 'String error',
        type: 'GENERIC_ERROR',
        context: 'test-context'
      });
    });
  });

  describe('handleAuthError', () => {
    it('should handle authentication errors correctly', () => {
      const error = createMockError('Auth error');
      const result = handleAuthError(error, 'login');

      expect(result).toBe(ERROR_MESSAGES.AUTHENTICATION_REQUIRED);
      expect(mockSafeLog.error).toHaveBeenCalledWith('Error in login:', {
        error: 'Auth error',
        type: 'AUTHENTICATION_REQUIRED',
        context: 'login'
      });
    });

    it('should report auth errors to monitoring service', () => {
      const { reportAuthError } = require('../errorMonitoring');
      const error = createMockError('Auth error');
      
      handleAuthError(error, 'login');

      expect(reportAuthError).toHaveBeenCalledWith(error, { action: 'login' });
    });
  });

  describe('handleNetworkError', () => {
    it('should handle network errors correctly', () => {
      const error = createMockError('Network error');
      const result = handleNetworkError(error, '/api/endpoint');

      expect(result).toBe(ERROR_MESSAGES.NETWORK_ERROR);
      expect(mockSafeLog.error).toHaveBeenCalledWith('Error in /api/endpoint:', {
        error: 'Network error',
        type: 'NETWORK_ERROR',
        context: '/api/endpoint'
      });
    });

    it('should report network errors to monitoring service', () => {
      const { reportNetworkError } = require('../errorMonitoring');
      const error = createMockError('Network error');
      
      handleNetworkError(error, '/api/endpoint');

      expect(reportNetworkError).toHaveBeenCalledWith(error, { endpoint: '/api/endpoint' });
    });
  });

  describe('handlePaymentError', () => {
    it('should handle payment errors correctly', () => {
      const error = createMockError('Payment error');
      const result = handlePaymentError(error, 'checkout');

      expect(result).toBe(ERROR_MESSAGES.PAYMENT_FAILED);
      expect(mockSafeLog.error).toHaveBeenCalledWith('Error in checkout:', {
        error: 'Payment error',
        type: 'PAYMENT_FAILED',
        context: 'checkout'
      });
    });

    it('should report payment errors to monitoring service', () => {
      const { reportPaymentError } = require('../errorMonitoring');
      const error = createMockError('Payment error');
      
      handlePaymentError(error, 'checkout');

      expect(reportPaymentError).toHaveBeenCalledWith(error, { context: 'checkout' });
    });
  });

  describe('handleFavoriteError', () => {
    it('should handle favorite errors correctly', () => {
      const error = createMockError('Favorite error');
      const result = handleFavoriteError(error, 'toggle-favorite');

      expect(result).toBe(ERROR_MESSAGES.FAVORITE_FAILED);
      expect(mockSafeLog.error).toHaveBeenCalledWith('Error in toggle-favorite:', {
        error: 'Favorite error',
        type: 'FAVORITE_FAILED',
        context: 'toggle-favorite'
      });
    });
  });

  describe('withErrorHandling', () => {
    it('should return result when operation succeeds', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await withErrorHandling(operation, 'test-operation');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle errors and return null', async () => {
      const error = createMockError('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);
      const result = await withErrorHandling(operation, 'test-operation');

      expect(result).toBeNull();
      expect(mockSafeLog.error).toHaveBeenCalled();
    });

    it('should use custom error type', async () => {
      const error = createMockError('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);
      
      await withErrorHandling(operation, 'test-operation', 'PAYMENT_FAILED');

      expect(mockSafeLog.error).toHaveBeenCalledWith('Error in test-operation:', {
        error: 'Operation failed',
        type: 'PAYMENT_FAILED',
        context: 'test-operation'
      });
    });
  });

  describe('handleValidationError', () => {
    it('should show validation error toast', () => {
      const { toast } = require('@/hooks/use-toast');
      
      handleValidationError('email', 'Invalid email format');

      expect(toast).toHaveBeenCalledWith({
        title: 'Validation Error',
        description: 'email: Invalid email format',
        variant: 'destructive'
      });
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have all required error messages', () => {
      expect(ERROR_MESSAGES).toHaveProperty('AUTHENTICATION_REQUIRED');
      expect(ERROR_MESSAGES).toHaveProperty('NETWORK_ERROR');
      expect(ERROR_MESSAGES).toHaveProperty('PAYMENT_FAILED');
      expect(ERROR_MESSAGES).toHaveProperty('UPLOAD_FAILED');
      expect(ERROR_MESSAGES).toHaveProperty('FAVORITE_FAILED');
      expect(ERROR_MESSAGES).toHaveProperty('SUBSCRIPTION_ERROR');
      expect(ERROR_MESSAGES).toHaveProperty('GENERIC_ERROR');
      expect(ERROR_MESSAGES).toHaveProperty('VALIDATION_ERROR');
    });

    it('should have user-friendly error messages', () => {
      expect(ERROR_MESSAGES.AUTHENTICATION_REQUIRED).toBe('Please log in to continue');
      expect(ERROR_MESSAGES.NETWORK_ERROR).toBe('Network connection issue. Please check your internet and try again.');
      expect(ERROR_MESSAGES.PAYMENT_FAILED).toBe('Payment processing failed. Please try again or contact support.');
      expect(ERROR_MESSAGES.GENERIC_ERROR).toBe('Something went wrong. Please try again.');
    });
  });
}); 