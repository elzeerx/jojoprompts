
import { SecurityUtils } from "./security";

// Security monitoring and logging utilities

interface SecurityEvent {
  type: 'auth_failure' | 'suspicious_activity' | 'rate_limit' | 'payment_error' | 'access_denied';
  userId?: string;
  ip?: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: string;
}

class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private readonly MAX_EVENTS = 1000;

  // Log security events
  logEvent(type: SecurityEvent['type'], details: Record<string, any>, userId?: string): void {
    const event: SecurityEvent = {
      type,
      userId,
      ip: this.getClientIP(),
      userAgent: navigator.userAgent,
      details,
      timestamp: new Date().toISOString()
    };

    this.events.push(event);
    
    // Keep only recent events
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // Console log for debugging (in production, send to logging service)
    console.warn('Security Event:', event);

    // Check for suspicious patterns
    this.checkSuspiciousActivity(event);
  }

  // Get client IP (when available)
  private getClientIP(): string | undefined {
    // This would typically be handled by the server
    return undefined;
  }

  // Check for suspicious activity patterns
  private checkSuspiciousActivity(event: SecurityEvent): void {
    const recentEvents = this.events.filter(e => 
      Date.now() - new Date(e.timestamp).getTime() < 5 * 60 * 1000 // Last 5 minutes
    );

    // Multiple auth failures
    if (event.type === 'auth_failure') {
      const authFailures = recentEvents.filter(e => 
        e.type === 'auth_failure' && e.ip === event.ip
      ).length;

      if (authFailures >= 5) {
        this.logEvent('suspicious_activity', {
          pattern: 'multiple_auth_failures',
          count: authFailures,
          ip: event.ip
        });
      }
    }

    // Rapid API requests
    const rapidRequests = recentEvents.filter(e => e.ip === event.ip).length;
    if (rapidRequests >= 50) {
      this.logEvent('suspicious_activity', {
        pattern: 'rapid_requests',
        count: rapidRequests,
        ip: event.ip
      });
    }
  }

  // Get recent security events (for admin dashboard)
  getRecentEvents(limit = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  // Get security metrics
  getSecurityMetrics(): Record<string, number> {
    const last24h = this.events.filter(e => 
      Date.now() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000
    );

    return {
      totalEvents: last24h.length,
      authFailures: last24h.filter(e => e.type === 'auth_failure').length,
      suspiciousActivity: last24h.filter(e => e.type === 'suspicious_activity').length,
      rateLimitHits: last24h.filter(e => e.type === 'rate_limit').length,
      paymentErrors: last24h.filter(e => e.type === 'payment_error').length,
      accessDenied: last24h.filter(e => e.type === 'access_denied').length
    };
  }
}

// Export singleton instance
export const securityMonitor = new SecurityMonitor();

// Error boundary for security-related errors
export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SecurityError';
    
    // Log security error
    securityMonitor.logEvent('access_denied', {
      error: message,
      code,
      details
    });
  }
}

// Simple rate limiting hook using built-in Map
export const useRateLimit = (key: string, maxRequests = 10, windowMs = 60000) => {
  const rateLimiter = SecurityUtils.createRateLimiter(maxRequests, windowMs);
  
  return (identifier: string = 'default'): boolean => {
    const allowed = rateLimiter(`${key}:${identifier}`);
    
    if (!allowed) {
      securityMonitor.logEvent('rate_limit', {
        key,
        identifier,
        maxRequests,
        windowMs
      });
    }
    
    return allowed;
  };
};
