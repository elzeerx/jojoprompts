import { toast } from "@/hooks/use-toast";
import { safeLog } from "./safeLogging";
import { reportError, reportPaymentError, reportNetworkError, reportAuthError, ErrorSeverity, ErrorCategory } from "./errorMonitoring";

// Common error messages for consistent user experience
export const ERROR_MESSAGES = {
  AUTHENTICATION_REQUIRED: "Please log in to continue",
  NETWORK_ERROR: "Network connection issue. Please check your internet and try again.",
  PAYMENT_FAILED: "Payment processing failed. Please try again or contact support.",
  UPLOAD_FAILED: "File upload failed. Please try again.",
  FAVORITE_FAILED: "Failed to update favorites. Please try again.",
  SUBSCRIPTION_ERROR: "Subscription update failed. Please try again.",
  GENERIC_ERROR: "Something went wrong. Please try again.",
  VALIDATION_ERROR: "Please check your input and try again."
} as const;

// Error types for consistent handling
export type ErrorType = keyof typeof ERROR_MESSAGES;

// Enhanced error handler with logging and user feedback
export function handleError(
  error: any, 
  context: string, 
  errorType: ErrorType = 'GENERIC_ERROR',
  showToast: boolean = true
) {
  const errorMessage = ERROR_MESSAGES[errorType];
  
  // Log error for debugging
  safeLog.error(`Error in ${context}:`, {
    error: error?.message || error?.toString(),
    type: errorType,
    context
  });

  // Report error to monitoring service
  if (error instanceof Error) {
    const severity = errorType === 'PAYMENT_FAILED' ? ErrorSeverity.HIGH : 
                    errorType === 'AUTHENTICATION_REQUIRED' ? ErrorSeverity.MEDIUM : 
                    ErrorSeverity.LOW;
    
    const category = errorType === 'PAYMENT_FAILED' ? ErrorCategory.PAYMENT :
                    errorType === 'AUTHENTICATION_REQUIRED' ? ErrorCategory.AUTHENTICATION :
                    ErrorCategory.UNKNOWN;

    reportError(error, severity, category, {});
  }

  // Show user-friendly toast if requested
  if (showToast) {
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive"
    });
  }

  return errorMessage;
}

// Specific error handlers for common operations
export function handleAuthError(error: any, context: string) {
  if (error instanceof Error) {
    reportAuthError(error, { action: context });
  }
  return handleError(error, context, 'AUTHENTICATION_REQUIRED');
}

export function handleNetworkError(error: any, context: string) {
  if (error instanceof Error) {
    reportNetworkError(error, { endpoint: context });
  }
  return handleError(error, context, 'NETWORK_ERROR');
}

export function handlePaymentError(error: any, context: string) {
  if (error instanceof Error) {
    reportPaymentError(error, { context });
  }
  return handleError(error, context, 'PAYMENT_FAILED');
}

export function handleUploadError(error: any, context: string) {
  return handleError(error, context, 'UPLOAD_FAILED');
}

export function handleFavoriteError(error: any, context: string) {
  return handleError(error, context, 'FAVORITE_FAILED');
}

// Async error wrapper for consistent error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  errorType: ErrorType = 'GENERIC_ERROR'
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context, errorType);
    return null;
  }
}

// Validation error handler
export function handleValidationError(field: string, message: string) {
  toast({
    title: "Validation Error",
    description: `${field}: ${message}`,
    variant: "destructive"
  });
} 