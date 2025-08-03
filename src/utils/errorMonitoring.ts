import { safeLog } from './safeLogging';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories
export enum ErrorCategory {
  NETWORK = 'network',
  PAYMENT = 'payment',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  RENDERING = 'rendering',
  DATABASE = 'database',
  UNKNOWN = 'unknown'
}

// Error context interface
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  componentStack?: string;
  additionalData?: Record<string, any>;
}

// Error report interface
export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  timestamp: string;
  retryCount?: number;
}

class ErrorMonitor {
  private errorReports: ErrorReport[] = [];
  private maxReports = 100; // Keep last 100 errors in memory
  private isReporting = false;

  // Report an error
  reportError(
    error: Error,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    context: Partial<ErrorContext> = {}
  ): string {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorReport: ErrorReport = {
      id: errorId,
      message: error.message,
      stack: error.stack,
      severity,
      category,
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        ...context
      },
      timestamp: new Date().toISOString()
    };

    // Add to local storage
    this.addErrorReport(errorReport);

    // Log for debugging
    safeLog.error('Error reported:', {
      id: errorId,
      message: error.message,
      severity,
      category,
      context: errorReport.context
    });

    // In production, you'd send this to your error reporting service
    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorService(errorReport);
    }

    return errorId;
  }

  // Report a payment error
  reportPaymentError(
    error: Error,
    paymentContext: {
      planId?: string;
      orderId?: string;
      paymentId?: string;
      userId?: string;
    }
  ): string {
    return this.reportError(
      error,
      ErrorSeverity.HIGH,
      ErrorCategory.PAYMENT,
      {
        ...paymentContext,
        componentStack: error.stack
      }
    );
  }

  // Report a network error
  reportNetworkError(
    error: Error,
    context: {
      endpoint?: string;
      method?: string;
      statusCode?: number;
    } = {}
  ): string {
    return this.reportError(
      error,
      ErrorSeverity.MEDIUM,
      ErrorCategory.NETWORK,
      context
    );
  }

  // Report an authentication error
  reportAuthError(
    error: Error,
    context: {
      action?: string;
      userId?: string;
    } = {}
  ): string {
    return this.reportError(
      error,
      ErrorSeverity.HIGH,
      ErrorCategory.AUTHENTICATION,
      context
    );
  }

  // Get error reports
  getErrorReports(limit: number = 10): ErrorReport[] {
    return this.errorReports
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Get errors by category
  getErrorsByCategory(category: ErrorCategory): ErrorReport[] {
    return this.errorReports.filter(report => report.category === category);
  }

  // Get errors by severity
  getErrorsBySeverity(severity: ErrorSeverity): ErrorReport[] {
    return this.errorReports.filter(report => report.severity === severity);
  }

  // Clear error reports
  clearErrorReports(): void {
    this.errorReports = [];
    localStorage.removeItem('error_reports');
  }

  // Get error statistics
  getErrorStats(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recentErrors: number;
  } {
    const byCategory = Object.values(ErrorCategory).reduce((acc, category) => {
      acc[category] = this.getErrorsByCategory(category).length;
      return acc;
    }, {} as Record<ErrorCategory, number>);

    const bySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
      acc[severity] = this.getErrorsBySeverity(severity).length;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = this.errorReports.filter(
      report => new Date(report.timestamp) > oneHourAgo
    ).length;

    return {
      total: this.errorReports.length,
      byCategory,
      bySeverity,
      recentErrors
    };
  }

  private addErrorReport(report: ErrorReport): void {
    this.errorReports.push(report);
    
    // Keep only the last maxReports
    if (this.errorReports.length > this.maxReports) {
      this.errorReports = this.errorReports.slice(-this.maxReports);
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('error_reports', JSON.stringify(this.errorReports));
    } catch (error) {
      safeLog.warn('Failed to store error reports in localStorage:', error);
    }
  }

  private async sendToErrorService(report: ErrorReport): Promise<void> {
    if (this.isReporting) return;
    
    this.isReporting = true;
    
    try {
      // In a real app, you'd send this to your error reporting service
      // For now, we'll just log it
      safeLog.info('Sending error report to monitoring service:', {
        id: report.id,
        severity: report.severity,
        category: report.category
      });
    } catch (error) {
      safeLog.error('Failed to send error report:', error);
    } finally {
      this.isReporting = false;
    }
  }

  // Load error reports from localStorage on initialization
  constructor() {
    try {
      const stored = localStorage.getItem('error_reports');
      if (stored) {
        this.errorReports = JSON.parse(stored);
      }
    } catch (error) {
      safeLog.warn('Failed to load error reports from localStorage:', error);
    }
  }
}

// Export singleton instance
export const errorMonitor = new ErrorMonitor();

// Convenience functions
export const reportError = (error: Error, severity?: ErrorSeverity, category?: ErrorCategory, context?: Partial<ErrorContext>) => 
  errorMonitor.reportError(error, severity, category, context);

export const reportPaymentError = (error: Error, paymentContext: any) => 
  errorMonitor.reportPaymentError(error, paymentContext);

export const reportNetworkError = (error: Error, context?: any) => 
  errorMonitor.reportNetworkError(error, context);

export const reportAuthError = (error: Error, context?: any) => 
  errorMonitor.reportAuthError(error, context); 