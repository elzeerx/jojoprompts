/**
 * Production-safe logging system
 * Replaces console.log statements throughout the application
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, any>;
  timestamp: string;
  userId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStorageEntries: number;
  enableRemoteLogging: boolean;
}

class Logger {
  private config: LoggerConfig;
  private storage: LogEntry[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG,
      enableConsole: process.env.NODE_ENV !== 'production',
      enableStorage: true,
      maxStorageEntries: 1000,
      enableRemoteLogging: process.env.NODE_ENV === 'production',
      ...config
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  private createLogEntry(
    level: LogLevel, 
    message: string, 
    context?: string, 
    data?: Record<string, any>,
    userId?: string
  ): LogEntry {
    return {
      level,
      message,
      context,
      data,
      timestamp: new Date().toISOString(),
      userId
    };
  }

  private writeLog(entry: LogEntry): void {
    if (this.config.enableConsole) {
      const prefix = `[${entry.timestamp}]${entry.context ? ` [${entry.context}]` : ''}`;
      
      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(prefix, entry.message, entry.data || '');
          break;
        case LogLevel.WARN:
          console.warn(prefix, entry.message, entry.data || '');
          break;
        case LogLevel.INFO:
          console.info(prefix, entry.message, entry.data || '');
          break;
        case LogLevel.DEBUG:
        case LogLevel.TRACE:
          console.log(prefix, entry.message, entry.data || '');
          break;
      }
    }

    if (this.config.enableStorage) {
      this.storage.push(entry);
      if (this.storage.length > this.config.maxStorageEntries) {
        this.storage.shift();
      }
    }

    // TODO: Implement remote logging for production
    if (this.config.enableRemoteLogging && entry.level <= LogLevel.WARN) {
      this.sendToRemote(entry);
    }
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    // Implementation for sending logs to remote service
    // This could be Supabase, external logging service, etc.
    try {
      // Placeholder for remote logging implementation
      // await supabase.from('app_logs').insert(entry);
    } catch (error) {
      // Fail silently to prevent logging loops
    }
  }

  error(message: string, context?: string, data?: Record<string, any>, userId?: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.writeLog(this.createLogEntry(LogLevel.ERROR, message, context, data, userId));
    }
  }

  warn(message: string, context?: string, data?: Record<string, any>, userId?: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog(this.createLogEntry(LogLevel.WARN, message, context, data, userId));
    }
  }

  info(message: string, context?: string, data?: Record<string, any>, userId?: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.writeLog(this.createLogEntry(LogLevel.INFO, message, context, data, userId));
    }
  }

  debug(message: string, context?: string, data?: Record<string, any>, userId?: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog(this.createLogEntry(LogLevel.DEBUG, message, context, data, userId));
    }
  }

  trace(message: string, context?: string, data?: Record<string, any>, userId?: string): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      this.writeLog(this.createLogEntry(LogLevel.TRACE, message, context, data, userId));
    }
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.storage.filter(entry => entry.level === level);
    }
    return [...this.storage];
  }

  clearLogs(): void {
    this.storage = [];
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  // Specialized logging methods for common use cases
  
  payment(message: string, data?: Record<string, any>, userId?: string): void {
    this.info(message, 'PAYMENT', data, userId);
  }

  auth(message: string, data?: Record<string, any>, userId?: string): void {
    this.info(message, 'AUTH', data, userId);
  }

  api(message: string, data?: Record<string, any>, userId?: string): void {
    this.debug(message, 'API', data, userId);
  }

  security(message: string, data?: Record<string, any>, userId?: string): void {
    this.warn(message, 'SECURITY', data, userId);
  }

  performance(message: string, data?: Record<string, any>): void {
    this.debug(message, 'PERFORMANCE', data);
  }
}

// Create singleton logger instance
export const logger = new Logger();

// Legacy console.log replacement helpers for gradual migration
export const legacyLog = {
  log: (message: string, data?: any) => logger.debug(message, 'LEGACY', data ? { data } : undefined),
  info: (message: string, data?: any) => logger.info(message, 'LEGACY', data ? { data } : undefined),
  warn: (message: string, data?: any) => logger.warn(message, 'LEGACY', data ? { data } : undefined),
  error: (message: string, data?: any) => logger.error(message, 'LEGACY', data ? { data } : undefined),
};