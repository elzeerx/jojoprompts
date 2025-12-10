/**
 * Standardized Error Handling Utility
 * Provides consistent error handling across the application
 */

import { createLogger } from './logging';

const logger = createLogger('ERROR_HANDLER');

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: ErrorContext
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Handle errors consistently across the application
 */
export function handleError(
  error: unknown,
  context?: ErrorContext,
  silent: boolean = false
): AppError {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof Error) {
    appError = new AppError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      context
    );
  } else {
    appError = new AppError(
      'An unexpected error occurred',
      'UNEXPECTED_ERROR',
      500,
      context
    );
  }

  // Log error
  if (!silent) {
    logger.error(appError.message, {
      code: appError.code,
      statusCode: appError.statusCode,
      context: appError.context,
      stack: appError.stack
    });
  }

  return appError;
}

/**
 * Common error types
 */
export const ErrorTypes = {
  // Authentication errors
  AUTH_REQUIRED: (context?: ErrorContext) => 
    new AppError('Authentication required', 'AUTH_REQUIRED', 401, context),
  
  AUTH_INVALID: (context?: ErrorContext) => 
    new AppError('Invalid credentials', 'AUTH_INVALID', 401, context),
  
  AUTH_EXPIRED: (context?: ErrorContext) => 
    new AppError('Session expired', 'AUTH_EXPIRED', 401, context),

  // Authorization errors
  FORBIDDEN: (context?: ErrorContext) => 
    new AppError('Access forbidden', 'FORBIDDEN', 403, context),
  
  INSUFFICIENT_PERMISSIONS: (context?: ErrorContext) => 
    new AppError('Insufficient permissions', 'INSUFFICIENT_PERMISSIONS', 403, context),

  // Resource errors
  NOT_FOUND: (resource: string, context?: ErrorContext) => 
    new AppError(`${resource} not found`, 'NOT_FOUND', 404, context),
  
  ALREADY_EXISTS: (resource: string, context?: ErrorContext) => 
    new AppError(`${resource} already exists`, 'ALREADY_EXISTS', 409, context),

  // Validation errors
  INVALID_INPUT: (message: string, context?: ErrorContext) => 
    new AppError(message, 'INVALID_INPUT', 400, context),
  
  MISSING_REQUIRED_FIELD: (field: string, context?: ErrorContext) => 
    new AppError(`Missing required field: ${field}`, 'MISSING_REQUIRED_FIELD', 400, context),

  // Payment errors
  PAYMENT_FAILED: (message: string, context?: ErrorContext) => 
    new AppError(message, 'PAYMENT_FAILED', 402, context),
  
  SUBSCRIPTION_REQUIRED: (context?: ErrorContext) => 
    new AppError('Subscription required', 'SUBSCRIPTION_REQUIRED', 402, context),

  // Database errors
  DATABASE_ERROR: (message: string, context?: ErrorContext) => 
    new AppError(message, 'DATABASE_ERROR', 500, context),
  
  QUERY_FAILED: (context?: ErrorContext) => 
    new AppError('Query failed', 'QUERY_FAILED', 500, context),

  // Network errors
  NETWORK_ERROR: (context?: ErrorContext) => 
    new AppError('Network error occurred', 'NETWORK_ERROR', 503, context),
  
  TIMEOUT: (context?: ErrorContext) => 
    new AppError('Request timeout', 'TIMEOUT', 504, context),

  // Rate limiting
  RATE_LIMIT: (context?: ErrorContext) => 
    new AppError('Rate limit exceeded', 'RATE_LIMIT', 429, context),
};

/**
 * Error boundary helper for React components
 */
export function logComponentError(
  error: Error,
  errorInfo: React.ErrorInfo,
  componentName: string
): void {
  logger.error('Component error', {
    component: componentName,
    error: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack
  });
}

/**
 * Helper to format error messages for users
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // Map common error messages to user-friendly versions
    const errorMap: Record<string, string> = {
      'Failed to fetch': 'Network error. Please check your connection.',
      'Network request failed': 'Unable to connect. Please try again.',
      'JWT expired': 'Your session has expired. Please log in again.',
    };

    for (const [key, message] of Object.entries(errorMap)) {
      if (error.message.includes(key)) {
        return message;
      }
    }
    
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}
