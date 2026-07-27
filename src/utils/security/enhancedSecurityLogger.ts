// Enhanced security logging with severity levels and categories
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logging';

const logger = createLogger('SECURITY_LOGGER');

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SecurityCategory = 'authentication' | 'authorization' | 'data_access' | 'system' | 'general';

export interface EnhancedSecurityEvent {
  action: string;
  severity: SecuritySeverity;
  category: SecurityCategory;
  details?: Record<string, any>;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
}

export class EnhancedSecurityLogger {
  private static getClientInfo() {
    return {
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer || null
    };
  }

  static async logSecurityEvent(event: EnhancedSecurityEvent): Promise<void> {
    try {
      // Pre-launch hardening (2026-07-27): browser must NOT INSERT into
      // public.security_logs. Live migration 20260727135637 revoked
      // authenticated write access on system/log tables. Any legitimate
      // security-event capture happens server-side (Edge Functions,
      // service_role) or via admin RPCs. Preserve the console signal
      // for developer visibility only.
      const logLevel = this.mapSeverityToLogLevel(event.severity);
      logger[logLevel](
        `[${event.category.toUpperCase()}] ${event.action}`,
        event.details,
      );
    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }



  private static mapSeverityToLogLevel(severity: SecuritySeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
      case 'info':
      default:
        return 'info';
    }
  }

  // Convenience methods for different security events
  static async logAuthenticationEvent(action: string, success: boolean, details?: Record<string, any>): Promise<void> {
    await this.logSecurityEvent({
      action,
      severity: success ? 'info' : 'high',
      category: 'authentication',
      details: {
        success,
        ...details
      }
    });
  }

  static async logAuthorizationFailure(action: string, resource: string, details?: Record<string, any>): Promise<void> {
    await this.logSecurityEvent({
      action: `unauthorized_access_attempt_${action}`,
      severity: 'high',
      category: 'authorization',
      details: {
        resource,
        ...details
      }
    });
  }

  static async logDataAccess(action: string, resource: string, severity: SecuritySeverity = 'info', details?: Record<string, any>): Promise<void> {
    await this.logSecurityEvent({
      action: `data_access_${action}`,
      severity,
      category: 'data_access',
      details: {
        resource,
        ...details
      }
    });
  }

  static async logSuspiciousActivity(action: string, details?: Record<string, any>): Promise<void> {
    await this.logSecurityEvent({
      action: `suspicious_activity_${action}`,
      severity: 'critical',
      category: 'system',
      details
    });
  }

  static async logSystemEvent(action: string, severity: SecuritySeverity = 'info', details?: Record<string, any>): Promise<void> {
    await this.logSecurityEvent({
      action,
      severity,
      category: 'system',
      details
    });
  }
}