// Secure logging utilities that prevent sensitive data exposure

export interface SecureLogEvent {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  category: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

class SecureLogger {
  private sensitiveFields = [
    'password', 'token', 'key', 'secret', 'email', 'phone', 
    'address', 'ssn', 'credit_card', 'payment_id', 'access_token',
    'refresh_token', 'api_key', 'private_key', 'first_name', 'last_name'
  ];

  // Sanitize objects to remove sensitive information
  private sanitizeData(data: any): any {
    if (data === null || data === undefined) return data;
    
    if (typeof data === 'string') {
      // Don't log full email addresses, just domain
      if (data.includes('@')) {
        const parts = data.split('@');
        return `${parts[0].substring(0, 2)}***@${parts[1]}`;
      }
      return data;
    }
    
    if (typeof data !== 'object') return data;
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.sanitizeData(value);
      }
    }
    
    return sanitized;
  }

  // Safe console logging that automatically sanitizes data
  log(level: SecureLogEvent['level'], message: string, category: string, metadata?: Record<string, any>, userId?: string): void {
    const sanitizedMetadata = metadata ? this.sanitizeData(metadata) : undefined;
    const sanitizedUserId = userId ? `user_${userId.substring(0, 8)}***` : undefined;
    
    const logEvent: SecureLogEvent = {
      level,
      message,
      category,
      userId: sanitizedUserId,
      metadata: sanitizedMetadata,
      timestamp: new Date().toISOString()
    };
    
    // In development, log to console with sanitized data
    if (process.env.NODE_ENV === 'development') {
      console[level === 'debug' ? 'log' : level](`[${category}] ${message}`, sanitizedMetadata);
    }
    
    // In production, this would send to a secure logging service
    // For now, we'll just store locally for debugging
    this.storeSecurely(logEvent);
  }

  private storeSecurely(event: SecureLogEvent): void {
    // In production, this would send to a secure logging service
    // For development, we'll use sessionStorage with a size limit
    try {
      const logs = this.getStoredLogs();
      logs.push(event);
      
      // Keep only last 100 logs to prevent memory issues
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      sessionStorage.setItem('secure_logs', JSON.stringify(logs));
    } catch (error) {
      // If storage fails, just ignore - don't break the app
      console.warn('Failed to store secure log');
    }
  }

  getStoredLogs(): SecureLogEvent[] {
    try {
      const stored = sessionStorage.getItem('secure_logs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // Clear logs (useful for privacy)
  clearLogs(): void {
    sessionStorage.removeItem('secure_logs');
  }
}

export const secureLogger = new SecureLogger();

// Convenience methods for different log levels
export const logInfo = (message: string, category: string, metadata?: Record<string, any>, userId?: string) => {
  secureLogger.log('info', message, category, metadata, userId);
};

export const logWarn = (message: string, category: string, metadata?: Record<string, any>, userId?: string) => {
  secureLogger.log('warn', message, category, metadata, userId);
};

export const logError = (message: string, category: string, metadata?: Record<string, any>, userId?: string) => {
  secureLogger.log('error', message, category, metadata, userId);
};

export const logDebug = (message: string, category: string, metadata?: Record<string, any>, userId?: string) => {
  secureLogger.log('debug', message, category, metadata, userId);
};
