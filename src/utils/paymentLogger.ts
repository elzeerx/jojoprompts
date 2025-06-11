// Payment system logging utilities with comprehensive debugging capabilities

export interface PaymentLogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'payment' | 'webhook' | 'database' | 'security' | 'api';
  message: string;
  chargeId?: string;
  userId?: string;
  amount?: number;
  currency?: string;
  status?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  source: string;
}

class PaymentLogger {
  private logs: PaymentLogEntry[] = [];
  private readonly MAX_LOGS = 1000;

  // Core logging method
  log(entry: Omit<PaymentLogEntry, 'timestamp'>): void {
    const logEntry: PaymentLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    this.logs.push(logEntry);
    
    // Keep only recent logs
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }

    // Console output for debugging
    this.outputToConsole(logEntry);
    
    // Store for debugging (in production, send to logging service)
    this.storeSecurely(logEntry);
  }

  private outputToConsole(entry: PaymentLogEntry): void {
    const prefix = `[${entry.category.toUpperCase()}]`;
    const context = entry.chargeId ? `[${entry.chargeId}]` : '';
    const message = `${prefix}${context} ${entry.message}`;
    
    switch (entry.level) {
      case 'error':
        console.error(message, entry.metadata);
        break;
      case 'warn':
        console.warn(message, entry.metadata);
        break;
      case 'debug':
        console.debug(message, entry.metadata);
        break;
      default:
        console.log(message, entry.metadata);
    }
  }

  private storeSecurely(entry: PaymentLogEntry): void {
    try {
      const logs = this.getStoredLogs();
      logs.push(entry);
      
      // Keep only last 500 logs in storage
      if (logs.length > 500) {
        logs.splice(0, logs.length - 500);
      }
      
      sessionStorage.setItem('payment_logs', JSON.stringify(logs));
    } catch (error) {
      console.warn('Failed to store payment log');
    }
  }

  // Specialized logging methods
  logPaymentCreation(chargeId: string, userId: string, amount: number, currency: string): void {
    this.log({
      level: 'info',
      category: 'payment',
      message: 'Payment creation initiated',
      chargeId,
      userId,
      amount,
      currency,
      source: 'TapPaymentButton'
    });
  }

  logPaymentSuccess(chargeId: string, userId: string): void {
    this.log({
      level: 'info',
      category: 'payment',
      message: 'Payment completed successfully',
      chargeId,
      userId,
      status: 'CAPTURED',
      source: 'PaymentHandler'
    });
  }

  logPaymentFailure(chargeId: string, userId: string, error: string): void {
    this.log({
      level: 'error',
      category: 'payment',
      message: 'Payment failed',
      chargeId,
      userId,
      status: 'FAILED',
      metadata: { error },
      source: 'PaymentHandler'
    });
  }

  logWebhookReceived(chargeId: string, status: string, userId?: string): void {
    this.log({
      level: 'info',
      category: 'webhook',
      message: 'Webhook received and processing',
      chargeId,
      userId,
      status,
      source: 'webhook-handler'
    });
  }

  logWebhookProcessed(chargeId: string, success: boolean, userId?: string): void {
    this.log({
      level: success ? 'info' : 'error',
      category: 'webhook',
      message: success ? 'Webhook processed successfully' : 'Webhook processing failed',
      chargeId,
      userId,
      source: 'webhook-handler'
    });
  }

  logDatabaseOperation(operation: string, success: boolean, chargeId?: string, userId?: string, error?: string): void {
    this.log({
      level: success ? 'info' : 'error',
      category: 'database',
      message: `Database ${operation} ${success ? 'successful' : 'failed'}`,
      chargeId,
      userId,
      metadata: error ? { error } : undefined,
      source: 'database-operation'
    });
  }

  logSecurityEvent(event: string, chargeId?: string, userId?: string, details?: Record<string, any>): void {
    this.log({
      level: 'warn',
      category: 'security',
      message: `Security event: ${event}`,
      chargeId,
      userId,
      metadata: details,
      source: 'security-monitor'
    });
  }

  logApiCall(endpoint: string, success: boolean, chargeId?: string, responseTime?: number, error?: string): void {
    this.log({
      level: success ? 'debug' : 'error',
      category: 'api',
      message: `API call to ${endpoint} ${success ? 'successful' : 'failed'}`,
      chargeId,
      metadata: {
        endpoint,
        responseTime,
        error
      },
      source: 'api-client'
    });
  }

  // Utility methods for debugging
  getStoredLogs(): PaymentLogEntry[] {
    try {
      const stored = sessionStorage.getItem('payment_logs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  getLogsByCategory(category: PaymentLogEntry['category']): PaymentLogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  getLogsByChargeId(chargeId: string): PaymentLogEntry[] {
    return this.logs.filter(log => log.chargeId === chargeId);
  }

  getLogsByUserId(userId: string): PaymentLogEntry[] {
    return this.logs.filter(log => log.userId === userId);
  }

  getRecentErrors(minutes = 60): PaymentLogEntry[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.logs.filter(log => 
      log.level === 'error' && new Date(log.timestamp) > cutoff
    );
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
    sessionStorage.removeItem('payment_logs');
  }

  // Get payment flow timeline for a specific charge
  getPaymentTimeline(chargeId: string): PaymentLogEntry[] {
    return this.logs
      .filter(log => log.chargeId === chargeId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Performance metrics
  getPerformanceMetrics(): {
    totalLogs: number;
    errorRate: number;
    avgResponseTime: number;
    lastError: PaymentLogEntry | null;
  } {
    const recentLogs = this.logs.filter(log => {
      const logTime = new Date(log.timestamp);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return logTime > oneHourAgo;
    });

    const errors = recentLogs.filter(log => log.level === 'error');
    const apiLogs = recentLogs.filter(log => 
      log.category === 'api' && log.metadata?.responseTime
    );
    
    const avgResponseTime = apiLogs.length > 0
      ? apiLogs.reduce((sum, log) => sum + (log.metadata?.responseTime || 0), 0) / apiLogs.length
      : 0;

    return {
      totalLogs: recentLogs.length,
      errorRate: recentLogs.length > 0 ? (errors.length / recentLogs.length) * 100 : 0,
      avgResponseTime,
      lastError: errors.length > 0 ? errors[errors.length - 1] : null
    };
  }
}

// Export singleton instance
export const paymentLogger = new PaymentLogger();

// Convenience methods
export const logPaymentCreation = (chargeId: string, userId: string, amount: number, currency: string) => {
  paymentLogger.logPaymentCreation(chargeId, userId, amount, currency);
};

export const logPaymentSuccess = (chargeId: string, userId: string) => {
  paymentLogger.logPaymentSuccess(chargeId, userId);
};

export const logPaymentFailure = (chargeId: string, userId: string, error: string) => {
  paymentLogger.logPaymentFailure(chargeId, userId, error);
};

export const logWebhookReceived = (chargeId: string, status: string, userId?: string) => {
  paymentLogger.logWebhookReceived(chargeId, status, userId);
};

export const logWebhookProcessed = (chargeId: string, success: boolean, userId?: string) => {
  paymentLogger.logWebhookProcessed(chargeId, success, userId);
};

export const logDatabaseOperation = (operation: string, success: boolean, chargeId?: string, userId?: string, error?: string) => {
  paymentLogger.logDatabaseOperation(operation, success, chargeId, userId, error);
};

export const logSecurityEvent = (event: string, chargeId?: string, userId?: string, details?: Record<string, any>) => {
  paymentLogger.logSecurityEvent(event, chargeId, userId, details);
};

export const logApiCall = (endpoint: string, success: boolean, chargeId?: string, responseTime?: number, error?: string) => {
  paymentLogger.logApiCall(endpoint, success, chargeId, responseTime, error);
};
