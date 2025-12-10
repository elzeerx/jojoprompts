/**
 * Standardized logging utility for Supabase Edge Functions
 * Provides consistent logging with context, levels, and structured data
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  functionName?: string;
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

export class EdgeLogger {
  private context: LogContext;
  private isDevelopment: boolean;

  constructor(context: LogContext = {}) {
    this.context = context;
    this.isDevelopment = Deno.env.get('ENVIRONMENT') !== 'production';
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = this.context.functionName ? `[${this.context.functionName}]` : '';
    const requestIdStr = this.context.requestId ? `[${this.context.requestId}]` : '';
    
    let output = `${timestamp} ${level.toUpperCase()} ${contextStr}${requestIdStr} ${message}`;
    
    if (data) {
      output += ` ${JSON.stringify(data)}`;
    }
    
    return output;
  }

  debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any): void {
    console.log(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message: string, data?: any): void {
    console.error(this.formatMessage('error', message, data));
  }

  // Convenience method for timing operations
  time(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.info(`${label} completed`, { duration_ms: duration });
    };
  }

  // Create a child logger with additional context
  child(additionalContext: LogContext): EdgeLogger {
    return new EdgeLogger({ ...this.context, ...additionalContext });
  }
}

/**
 * Create a logger instance for an edge function
 * @param functionName - Name of the edge function
 * @param requestId - Optional request ID for tracking
 */
export function createEdgeLogger(functionName: string, requestId?: string): EdgeLogger {
  return new EdgeLogger({ functionName, requestId });
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
