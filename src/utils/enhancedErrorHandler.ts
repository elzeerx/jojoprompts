
import { toast } from '@/hooks/use-toast';
import { secureLogger } from './secureLogging';

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export class EnhancedErrorHandler {
  static handle(error: any, context: ErrorContext = {}) {
    const errorMessage = this.extractErrorMessage(error);
    const errorCode = this.extractErrorCode(error);
    
    // Log the error securely
    secureLogger.log('error', errorMessage, context.component || 'unknown', {
      error_code: errorCode,
      action: context.action,
      stack: error?.stack?.substring(0, 500), // Limit stack trace length
      ...context.metadata
    }, context.userId);

    // Show user-friendly toast
    toast({
      title: this.getUserFriendlyTitle(errorCode),
      description: this.getUserFriendlyMessage(errorMessage, errorCode),
      variant: "destructive",
    });

    return {
      message: errorMessage,
      code: errorCode,
      recoverable: this.isRecoverable(errorCode)
    };
  }

  private static extractErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error?.message) return error.error.message;
    return 'An unexpected error occurred';
  }

  private static extractErrorCode(error: any): string {
    if (error?.code) return error.code;
    if (error?.status) return `HTTP_${error.status}`;
    if (error?.name) return error.name;
    return 'UNKNOWN_ERROR';
  }

  private static getUserFriendlyTitle(errorCode: string): string {
    const titleMap: Record<string, string> = {
      'NETWORK_ERROR': 'Connection Problem',
      'HTTP_401': 'Authentication Required',
      'HTTP_403': 'Access Denied',
      'HTTP_404': 'Not Found',
      'HTTP_500': 'Server Error',
      'VALIDATION_ERROR': 'Invalid Input',
      'TIMEOUT_ERROR': 'Request Timeout',
    };

    return titleMap[errorCode] || 'Error';
  }

  private static getUserFriendlyMessage(message: string, errorCode: string): string {
    const messageMap: Record<string, string> = {
      'NETWORK_ERROR': 'Please check your internet connection and try again.',
      'HTTP_401': 'Please log in to continue.',
      'HTTP_403': 'You don\'t have permission to perform this action.',
      'HTTP_404': 'The requested resource was not found.',
      'HTTP_500': 'Something went wrong on our end. Please try again later.',
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'TIMEOUT_ERROR': 'The request is taking too long. Please try again.',
    };

    return messageMap[errorCode] || message;
  }

  private static isRecoverable(errorCode: string): boolean {
    const recoverableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'HTTP_500',
      'HTTP_502',
      'HTTP_503',
      'HTTP_504'
    ];

    return recoverableCodes.includes(errorCode);
  }
}
