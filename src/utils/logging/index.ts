// Unified logging system for frontend
// Provides structured logging with multiple sinks and security event routing

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSink = 'console' | 'remote' | 'security';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
  userId?: string;
  sessionId?: string;
}

interface SecurityLogEntry extends LogEntry {
  action: string;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}

class UnifiedLogger {
  private sinks: Set<LogSink> = new Set(['console']);
  private minLevel: LogLevel = import.meta.env.DEV ? 'debug' : 'info';
  private sessionId: string = this.generateSessionId();
  private isLogging: boolean = false; // Recursion protection
  private nativeConsole = globalThis.console; // Save native console reference

  constructor() {
    // Initialize with default sinks
    if (import.meta.env.PROD) {
      this.sinks.add('remote'); // Enable remote logging in production
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return levels[level] >= levels[this.minLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const context = entry.context ? `[${entry.context}]` : '';
    return `${timestamp} ${entry.level.toUpperCase()} ${context} ${entry.message}`;
  }

  private async sendToSinks(entry: LogEntry): Promise<void> {
    // Prevent recursion
    if (this.isLogging) return;
    this.isLogging = true;

    try {
      // Console sink - use native console to avoid recursion
      if (this.sinks.has('console')) {
        const formatted = this.formatMessage(entry);
        switch (entry.level) {
          case 'debug':
            this.nativeConsole.log(formatted, entry.data);
            break;
          case 'info':
            this.nativeConsole.info(formatted, entry.data);
            break;
          case 'warn':
            this.nativeConsole.warn(formatted, entry.data);
            break;
          case 'error':
            this.nativeConsole.error(formatted, entry.data);
            break;
        }
      }

      // Remote sink (future: send to external service)
      if (this.sinks.has('remote') && entry.level !== 'debug') {
        try {
          // Future: implement remote logging service
          // await this.sendToRemoteService(entry);
        } catch (error) {
          // Use native console for remote logging failures to avoid recursion
          this.nativeConsole.warn('Failed to send log to remote service:', error);
        }
      }
    } finally {
      this.isLogging = false;
    }
  }

  private createEntry(
    level: LogLevel, 
    message: string, 
    context?: string, 
    data?: any,
    userId?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
      userId,
      sessionId: this.sessionId
    };
  }

  // Public logging methods
  debug(message: string, context?: string, data?: any): void {
    if (!this.shouldLog('debug')) return;
    const entry = this.createEntry('debug', message, context, data);
    this.sendToSinks(entry);
  }

  info(message: string, context?: string, data?: any): void {
    if (!this.shouldLog('info')) return;
    const entry = this.createEntry('info', message, context, data);
    this.sendToSinks(entry);
  }

  warn(message: string, context?: string, data?: any): void {
    if (!this.shouldLog('warn')) return;
    const entry = this.createEntry('warn', message, context, data);
    this.sendToSinks(entry);
  }

  error(message: string, context?: string, data?: any): void {
    if (!this.shouldLog('error')) return;
    const entry = this.createEntry('error', message, context, data);
    this.sendToSinks(entry);
  }

  // Security-specific logging facade
  security(entry: Omit<SecurityLogEntry, 'timestamp' | 'sessionId'>): void {
    const securityEntry: SecurityLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    };

    // Always log security events regardless of level - use native console to avoid recursion
    if (this.sinks.has('console')) {
      const formatted = `🔒 SECURITY [${entry.action}] ${entry.message}`;
      if (entry.success === false) {
        this.nativeConsole.error(formatted, securityEntry);
      } else {
        this.nativeConsole.info(formatted, securityEntry);
      }
    }

    // Future: Route to security-specific remote sink
    if (this.sinks.has('security') || this.sinks.has('remote')) {
      try {
        // Future: send to security monitoring service
        // await this.sendToSecurityService(securityEntry);
      } catch (error) {
        this.nativeConsole.warn('Failed to send security log:', error);
      }
    }
  }

  // Configuration methods
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  enableSink(sink: LogSink): void {
    this.sinks.add(sink);
  }

  disableSink(sink: LogSink): void {
    this.sinks.delete(sink);
  }

  // Context-aware logging for components
  createContextLogger(context: string) {
    return {
      debug: (message: string, data?: any) => this.debug(message, context, data),
      info: (message: string, data?: any) => this.info(message, context, data),
      warn: (message: string, data?: any) => this.warn(message, context, data),
      error: (message: string, data?: any) => this.error(message, context, data),
      security: (entry: Omit<SecurityLogEntry, 'timestamp' | 'sessionId' | 'context'>) => 
        this.security({ ...entry, context })
    };
  }
}

// Global logger instance
export const logger = new UnifiedLogger();

// Convenience exports for common use cases
export const createLogger = (context: string) => logger.createContextLogger(context);
export const logSecurity = (entry: Omit<SecurityLogEntry, 'timestamp' | 'sessionId'>) => logger.security(entry);

// Legacy console replacement (for gradual migration)
export const console = {
  log: (message: string, ...args: any[]) => logger.info(message, 'LEGACY', args.length > 0 ? args : undefined),
  info: (message: string, ...args: any[]) => logger.info(message, 'LEGACY', args.length > 0 ? args : undefined),
  warn: (message: string, ...args: any[]) => logger.warn(message, 'LEGACY', args.length > 0 ? args : undefined),
  error: (message: string, ...args: any[]) => logger.error(message, 'LEGACY', args.length > 0 ? args : undefined),
  debug: (message: string, ...args: any[]) => logger.debug(message, 'LEGACY', args.length > 0 ? args : undefined),
};

// Environment-specific configuration
if (import.meta.env.DEV) {
  logger.setLevel('debug');
  logger.info('Unified logging system initialized', 'LOGGING');
} else {
  logger.setLevel('info');
  logger.enableSink('remote');
  logger.enableSink('security');
}