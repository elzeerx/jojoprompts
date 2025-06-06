
// Payment error recovery utilities
export interface PaymentError {
  message: string;
  code?: string;
  method?: string;
  recoverable?: boolean;
  critical?: boolean;
}

export class PaymentErrorRecovery {
  // Analyze error and determine recovery strategy
  static analyzeError(error: any, method: string): PaymentError {
    const message = error.message || error.toString();
    const lowerMessage = message.toLowerCase();

    let recoverable = true;
    let critical = false;

    // Network-related errors
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('connection')) {
      return {
        message: `Network connection issue with ${method}. Please check your internet connection and try again.`,
        code: 'NETWORK_ERROR',
        method,
        recoverable: true,
        critical: false
      };
    }

    // Script loading errors
    if (lowerMessage.includes('script') || lowerMessage.includes('load')) {
      return {
        message: `${method} payment system failed to load. Please refresh the page and try again.`,
        code: 'SCRIPT_LOAD_ERROR',
        method,
        recoverable: true,
        critical: false
      };
    }

    // Timeout errors
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return {
        message: `${method} is taking too long to respond. Please try again.`,
        code: 'TIMEOUT_ERROR',
        method,
        recoverable: true,
        critical: false
      };
    }

    // Configuration errors
    if (lowerMessage.includes('configuration') || lowerMessage.includes('config')) {
      return {
        message: `${method} is temporarily unavailable due to configuration issues.`,
        code: 'CONFIG_ERROR',
        method,
        recoverable: false,
        critical: true
      };
    }

    // Authentication errors
    if (lowerMessage.includes('authentication') || lowerMessage.includes('auth')) {
      return {
        message: `Authentication error with ${method}. Please refresh the page and try again.`,
        code: 'AUTH_ERROR',
        method,
        recoverable: true,
        critical: false
      };
    }

    // Payment-specific errors
    if (lowerMessage.includes('payment') && lowerMessage.includes('fail')) {
      return {
        message: `Payment processing failed with ${method}. Please try again or use an alternative payment method.`,
        code: 'PAYMENT_FAILED',
        method,
        recoverable: true,
        critical: false
      };
    }

    // Default error handling
    return {
      message: `${method} encountered an unexpected issue. Please try again.`,
      code: 'UNKNOWN_ERROR',
      method,
      recoverable: true,
      critical: false
    };
  }

  // Get user-friendly suggestions based on error type
  static getRecoverySuggestions(error: PaymentError): string[] {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return [
          'Check your internet connection',
          'Disable VPN if active',
          'Try switching networks'
        ];
      
      case 'SCRIPT_LOAD_ERROR':
        return [
          'Refresh the page',
          'Disable ad blockers',
          'Clear browser cache'
        ];
      
      case 'TIMEOUT_ERROR':
        return [
          'Check connection speed',
          'Try again in a moment',
          'Refresh and retry'
        ];
      
      case 'CONFIG_ERROR':
        return [
          'Try the alternative payment method',
          'Contact support if issue persists'
        ];
      
      case 'AUTH_ERROR':
        return [
          'Refresh the page',
          'Log out and log back in',
          'Clear browser cookies'
        ];
      
      case 'PAYMENT_FAILED':
        return [
          'Verify payment details',
          'Try alternative payment method',
          'Contact your bank'
        ];
      
      default:
        return [
          'Refresh the page',
          'Try alternative payment method',
          'Contact support if issue persists'
        ];
    }
  }

  // Determine if auto-retry is appropriate
  static shouldAutoRetry(error: PaymentError, attemptCount: number): boolean {
    if (!error.recoverable || error.critical) {
      return false;
    }

    if (attemptCount >= 3) {
      return false;
    }

    // Only auto-retry for certain error types
    const autoRetryableCodes = ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SCRIPT_LOAD_ERROR'];
    return autoRetryableCodes.includes(error.code || '');
  }

  // Calculate retry delay with exponential backoff
  static getRetryDelay(attemptCount: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 8000; // 8 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attemptCount), maxDelay);
    
    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    return delay + jitter;
  }
}
