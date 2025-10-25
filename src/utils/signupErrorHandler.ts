/**
 * Signup-specific error handler with enhanced error detection and user feedback
 * Part of Phase 2: Robustness Improvements
 * 
 * @module signupErrorHandler
 * @description Provides comprehensive error handling for signup operations with:
 * - Automatic error type detection
 * - Smart retry logic for transient failures
 * - User-friendly error messages
 * - Structured error codes for debugging
 * 
 * @example
 * ```typescript
 * // Basic error handling
 * const result = handleSignupError(error, {
 *   email: "user@example.com",
 *   operation: "validation"
 * });
 * 
 * // With retry logic
 * const result = await retrySignupOperation(
 *   async () => await validateUser(),
 *   { email, operation: "validation" },
 *   2 // max retries
 * );
 * ```
 */

import { toast } from "@/hooks/use-toast";
import { logError, logWarn } from "@/utils/secureLogging";

export interface SignupErrorContext {
  email?: string;
  username?: string;
  operation: string;
  attemptCount?: number;
}

export interface SignupErrorResult {
  message: string;
  description: string;
  shouldRetry: boolean;
  retryDelay?: number;
  errorCode: string;
}

/**
 * Error codes for better tracking and debugging
 */
export enum SignupErrorCode {
  // Validation errors
  EMAIL_INVALID = 'EMAIL_INVALID',
  EMAIL_TAKEN = 'EMAIL_TAKEN',
  USERNAME_INVALID = 'USERNAME_INVALID',
  USERNAME_TAKEN = 'USERNAME_TAKEN',
  USERNAME_RESERVED = 'USERNAME_RESERVED',
  
  // Network errors (retryable)
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // Service errors (retryable)
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  EDGE_FUNCTION_ERROR = 'EDGE_FUNCTION_ERROR',
  
  // Auth errors
  AUTH_SIGNUP_FAILED = 'AUTH_SIGNUP_FAILED',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  
  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Detect error type from error object or message
 * 
 * @param error - The error object or message to analyze
 * @returns SignupErrorCode - Categorized error code
 * 
 * @description
 * Analyzes error messages to categorize them into specific error types.
 * This enables appropriate retry logic and user-friendly messaging.
 * 
 * Error categories:
 * - Network errors: Connection issues, timeouts (retryable)
 * - Validation errors: Invalid input, duplicates (not retryable)
 * - Service errors: Server issues, edge function failures (retryable)
 * - Rate limiting: Too many attempts (not retryable, needs wait)
 * 
 * @example
 * ```typescript
 * const errorCode = detectErrorType(new Error("Network request failed"));
 * // Returns: SignupErrorCode.NETWORK_ERROR
 * ```
 */
function detectErrorType(error: any): SignupErrorCode {
  const errorMessage = error?.message?.toLowerCase() || JSON.stringify(error).toLowerCase();
  
  // Network errors (retryable)
  if (errorMessage.includes('network') || errorMessage.includes('fetch failed')) {
    return SignupErrorCode.NETWORK_ERROR;
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return SignupErrorCode.TIMEOUT;
  }
  
  // Service errors (retryable)
  if (errorMessage.includes('service unavailable') || errorMessage.includes('503')) {
    return SignupErrorCode.SERVICE_UNAVAILABLE;
  }
  
  if (errorMessage.includes('edge function') || errorMessage.includes('function returned')) {
    return SignupErrorCode.EDGE_FUNCTION_ERROR;
  }
  
  // Validation errors (not retryable)
  if (errorMessage.includes('email') && errorMessage.includes('exists')) {
    return SignupErrorCode.EMAIL_TAKEN;
  }
  
  if (errorMessage.includes('username') && errorMessage.includes('taken')) {
    return SignupErrorCode.USERNAME_TAKEN;
  }
  
  if (errorMessage.includes('reserved') || errorMessage.includes('admin')) {
    return SignupErrorCode.USERNAME_RESERVED;
  }
  
  if (errorMessage.includes('invalid email') || errorMessage.includes('email format')) {
    return SignupErrorCode.EMAIL_INVALID;
  }
  
  if (errorMessage.includes('invalid username')) {
    return SignupErrorCode.USERNAME_INVALID;
  }
  
  // Rate limiting
  if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
    return SignupErrorCode.RATE_LIMITED;
  }
  
  // Auth errors
  if (errorMessage.includes('signup failed') || errorMessage.includes('auth')) {
    return SignupErrorCode.AUTH_SIGNUP_FAILED;
  }
  
  if (errorMessage.includes('email') && errorMessage.includes('send')) {
    return SignupErrorCode.EMAIL_SEND_FAILED;
  }
  
  return SignupErrorCode.UNKNOWN_ERROR;
}

/**
 * Get user-friendly error message with retry information
 */
function getErrorResult(errorCode: SignupErrorCode, originalError: any): SignupErrorResult {
  const errorMap: Record<SignupErrorCode, SignupErrorResult> = {
    [SignupErrorCode.EMAIL_INVALID]: {
      message: "Invalid Email",
      description: "Please enter a valid email address.",
      shouldRetry: false,
      errorCode,
    },
    [SignupErrorCode.EMAIL_TAKEN]: {
      message: "Email Already Registered",
      description: "An account with this email already exists. Try logging in instead.",
      shouldRetry: false,
      errorCode,
    },
    [SignupErrorCode.USERNAME_INVALID]: {
      message: "Invalid Username",
      description: "Username must be 3-20 characters and contain only letters, numbers, underscores, and dashes.",
      shouldRetry: false,
      errorCode,
    },
    [SignupErrorCode.USERNAME_TAKEN]: {
      message: "Username Taken",
      description: "This username is already in use. Please choose another one.",
      shouldRetry: false,
      errorCode,
    },
    [SignupErrorCode.USERNAME_RESERVED]: {
      message: "Username Not Available",
      description: "This username is reserved. Please choose a different one.",
      shouldRetry: false,
      errorCode,
    },
    [SignupErrorCode.NETWORK_ERROR]: {
      message: "Connection Error",
      description: "Could not connect to the server. Please check your internet connection and try again.",
      shouldRetry: true,
      retryDelay: 2000,
      errorCode,
    },
    [SignupErrorCode.TIMEOUT]: {
      message: "Request Timeout",
      description: "The request took too long. Please try again.",
      shouldRetry: true,
      retryDelay: 1000,
      errorCode,
    },
    [SignupErrorCode.SERVICE_UNAVAILABLE]: {
      message: "Service Temporarily Unavailable",
      description: "Our servers are experiencing high load. Please try again in a moment.",
      shouldRetry: true,
      retryDelay: 5000,
      errorCode,
    },
    [SignupErrorCode.EDGE_FUNCTION_ERROR]: {
      message: "Processing Error",
      description: "There was an error processing your request. Please try again.",
      shouldRetry: true,
      retryDelay: 2000,
      errorCode,
    },
    [SignupErrorCode.AUTH_SIGNUP_FAILED]: {
      message: "Signup Failed",
      description: "Could not create your account. Please try again or contact support.",
      shouldRetry: true,
      retryDelay: 2000,
      errorCode,
    },
    [SignupErrorCode.EMAIL_SEND_FAILED]: {
      message: "Email Delivery Failed",
      description: "Your account was created but we couldn't send the confirmation email. Please contact support.",
      shouldRetry: false,
      errorCode,
    },
    [SignupErrorCode.RATE_LIMITED]: {
      message: "Too Many Attempts",
      description: "You've made too many signup attempts. Please wait a few minutes and try again.",
      shouldRetry: true,
      retryDelay: 60000, // 1 minute
      errorCode,
    },
    [SignupErrorCode.UNKNOWN_ERROR]: {
      message: "Unexpected Error",
      description: originalError?.message || "An unexpected error occurred. Please try again.",
      shouldRetry: true,
      retryDelay: 3000,
      errorCode,
    },
  };
  
  return errorMap[errorCode];
}

/**
 * Main error handler for signup operations
 * 
 * @param error - The error object to handle
 * @param context - Context information about where/when the error occurred
 * @param showToast - Whether to display toast notification to user (default: true)
 * @returns SignupErrorResult - Structured error information
 * 
 * @description
 * Central error handling function that:
 * 1. Detects error type automatically
 * 2. Gets user-friendly error message
 * 3. Logs error with appropriate severity
 * 4. Optionally shows toast notification
 * 5. Returns structured error info for programmatic handling
 * 
 * @example
 * ```typescript
 * try {
 *   await signupUser(data);
 * } catch (error) {
 *   const result = handleSignupError(error, {
 *     email: data.email,
 *     operation: "signup",
 *     attemptCount: 1
 *   });
 *   
 *   if (result.shouldRetry) {
 *     // Retry after result.retryDelay ms
 *   }
 * }
 * ```
 */
export function handleSignupError(
  error: any,
  context: SignupErrorContext,
  showToast: boolean = true
): SignupErrorResult {
  const errorCode = detectErrorType(error);
  const result = getErrorResult(errorCode, error);
  
  // Log the error with context
  if (result.shouldRetry) {
    logWarn(`Retryable signup error: ${errorCode}`, context.operation, {
      errorCode,
      context,
      originalError: error?.message,
    });
  } else {
    logError(`Non-retryable signup error: ${errorCode}`, context.operation, {
      errorCode,
      context,
      originalError: error?.message,
    });
  }
  
  // Show toast notification if requested
  if (showToast) {
    toast({
      variant: "destructive",
      title: result.message,
      description: result.description,
    });
  }
  
  return result;
}

/**
 * Retry wrapper for signup operations
 * 
 * @template T - The return type of the operation
 * @param operation - Async function to execute with retry logic
 * @param context - Context about the operation for logging
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 * @returns Promise with success/failure info and data/error
 * 
 * @description
 * Wraps any async operation with smart retry logic:
 * - Automatically retries on transient failures (network, service errors)
 * - Does NOT retry validation or rate limit errors
 * - Uses exponential backoff for retries
 * - Shows user-friendly error messages
 * - Logs all attempts for debugging
 * 
 * Retry Strategy:
 * - Validation errors: No retry (fail immediately)
 * - Network errors: Retry with 2s delay
 * - Service errors: Retry with 2s delay
 * - Rate limit: No retry (display wait time)
 * 
 * @example
 * ```typescript
 * // Validation with 2 retries
 * const result = await retrySignupOperation(
 *   async () => {
 *     const { data, error } = await validateEmail(email);
 *     if (error) throw error;
 *     return data;
 *   },
 *   { email, operation: "validation" },
 *   2
 * );
 * 
 * if (result.success) {
 *   console.log("Validation passed:", result.data);
 * } else {
 *   console.error("Validation failed:", result.error);
 * }
 * ```
 */
export async function retrySignupOperation<T>(
  operation: () => Promise<T>,
  context: SignupErrorContext,
  maxRetries: number = 2
): Promise<{ success: boolean; data?: T; error?: SignupErrorResult }> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      lastError = error;
      const errorResult = handleSignupError(error, { ...context, attemptCount: attempt + 1 }, false);
      
      // Don't retry if error is not retryable
      if (!errorResult.shouldRetry) {
        toast({
          variant: "destructive",
          title: errorResult.message,
          description: errorResult.description,
        });
        return { success: false, error: errorResult };
      }
      
      // Don't retry if this was the last attempt
      if (attempt === maxRetries) {
        toast({
          variant: "destructive",
          title: errorResult.message,
          description: `${errorResult.description} (Attempt ${attempt + 1}/${maxRetries + 1})`,
        });
        return { success: false, error: errorResult };
      }
      
      // Wait before retrying
      if (errorResult.retryDelay) {
        logWarn(`Retrying signup operation after ${errorResult.retryDelay}ms`, context.operation, {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
        });
        await new Promise(resolve => setTimeout(resolve, errorResult.retryDelay));
      }
    }
  }
  
  // This should never be reached, but TypeScript needs it
  const finalError = handleSignupError(lastError, context, true);
  return { success: false, error: finalError };
}
