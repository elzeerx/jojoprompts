// Production-safe logging utility that sanitizes sensitive data and controls output

interface LogData {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  userId?: string;
  timestamp: string;
}

class ProductionLogger {
  private isDevelopment = import.meta.env.DEV;
  private sensitiveKeys = [
    'password', 'token', 'secret', 'key', 'email', 'api_key',
    'access_token', 'refresh_token', 'session_id', 'auth_token'
  ];

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (this.sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    });
    
    return sanitized;
  }

  private log(level: LogData['level'], message: string, data?: any, userId?: string) {
    const logEntry: LogData = {
      level,
      message,
      data: this.sanitizeData(data),
      userId: userId ? `user_${userId.substring(0, 8)}***` : undefined,
      timestamp: new Date().toISOString()
    };

    // In development, log to console
    if (this.isDevelopment) {
      const method = level === 'debug' ? 'log' : level;
      console[method](`[${level.toUpperCase()}] ${message}`, logEntry.data || '');
    }

    // In production, you would send to a logging service
    // For now, store critical errors in sessionStorage for debugging
    if (level === 'error' && !this.isDevelopment) {
      try {
        const errors = JSON.parse(sessionStorage.getItem('app_errors') || '[]');
        errors.push(logEntry);
        if (errors.length > 10) errors.shift(); // Keep only last 10 errors
        sessionStorage.setItem('app_errors', JSON.stringify(errors));
      } catch {
        // Ignore storage errors
      }
    }
  }

  info(message: string, data?: any, userId?: string) {
    this.log('info', message, data, userId);
  }

  warn(message: string, data?: any, userId?: string) {
    this.log('warn', message, data, userId);
  }

  error(message: string, data?: any, userId?: string) {
    this.log('error', message, data, userId);
  }

  debug(message: string, data?: any, userId?: string) {
    if (this.isDevelopment) {
      this.log('debug', message, data, userId);
    }
  }

  // Replace console.log calls in production
  safeLog(message: string, data?: any) {
    if (this.isDevelopment) {
      console.log(message, data);
    }
  }
}

export const logger = new ProductionLogger();