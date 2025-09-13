// Enhanced security audit system with comprehensive logging
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

export interface SecurityAuditEvent {
  user_id?: string;
  admin_user_id?: string;
  action: string;
  target_resource?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  geolocation?: {
    country?: string;
    city?: string;
    ip?: string;
  };
  risk_score?: number;
  prevented?: boolean;
}

export interface SecurityMetrics {
  failed_logins: number;
  suspicious_activity: number;
  blocked_ips: number;
  rate_limit_violations: number;
  admin_actions: number;
}

// Risk scoring for security events
const RISK_SCORES: Record<string, number> = {
  'admin_function_access_granted': 1,
  'user_creation_success': 2,
  'user_update_success': 2,
  'user_deletion_success': 5,
  'password_change_success': 3,
  'bulk_operation_complete': 4,
  'permission_denied': 3,
  'authentication_failed': 4,
  'suspicious_activity': 8,
  'multiple_failed_logins': 7,
  'admin_modification_attempt': 9,
  'critical_system_change': 10
};

// Enhanced security audit logger
export class SecurityAuditLogger {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  async logSecurityEvent(event: SecurityAuditEvent): Promise<void> {
    try {
      // Calculate risk score
      const riskScore = event.risk_score || RISK_SCORES[event.action] || 1;
      
      // Enhanced event data
      const auditEvent = {
        user_id: event.user_id,
        admin_user_id: event.admin_user_id,
        action: event.action,
        target_resource: event.target_resource,
        severity: event.severity,
        details: {
          ...event.details,
          risk_score: riskScore,
          timestamp: new Date().toISOString(),
          prevented: event.prevented || false
        },
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        session_id: event.session_id,
        geolocation: event.geolocation,
        created_at: new Date().toISOString()
      };

      // Log to security_logs table
      await this.supabase
        .from('security_logs')
        .insert(auditEvent);

      // If admin action, also log to admin_audit_log
      if (event.admin_user_id) {
        await this.supabase
          .from('admin_audit_log')
          .insert({
            admin_user_id: event.admin_user_id,
            action: event.action,
            target_resource: event.target_resource || 'unknown',
            metadata: auditEvent.details,
            ip_address: event.ip_address,
            timestamp: new Date().toISOString()
          });
      }

      // Alert on high-risk events
      if (riskScore >= 8) {
        await this.alertHighRiskEvent(auditEvent);
      }

    } catch (error) {
      console.error('Failed to log security event:', error);
      // Don't throw - logging failures shouldn't block operations
    }
  }

  async alertHighRiskEvent(event: any): Promise<void> {
    try {
      // Log critical alert
      await this.supabase
        .from('security_alerts')
        .insert({
          alert_type: 'high_risk_activity',
          severity: 'critical',
          details: event,
          requires_review: true,
          created_at: new Date().toISOString()
        });

      console.warn('HIGH RISK SECURITY EVENT:', {
        action: event.action,
        user_id: event.user_id,
        admin_user_id: event.admin_user_id,
        risk_score: event.details.risk_score,
        ip_address: event.ip_address
      });

    } catch (error) {
      console.error('Failed to create security alert:', error);
    }
  }

  async getSecurityMetrics(timeframe: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<SecurityMetrics> {
    const timeframes = {
      '1h': 1 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const since = new Date(Date.now() - timeframes[timeframe]).toISOString();

    try {
      // Get failed logins
      const { count: failedLogins } = await this.supabase
        .from('security_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'authentication_failed')
        .gte('created_at', since);

      // Get suspicious activity
      const { count: suspiciousActivity } = await this.supabase
        .from('security_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'suspicious_activity')
        .gte('created_at', since);

      // Get admin actions
      const { count: adminActions } = await this.supabase
        .from('admin_audit_log')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', since);

      return {
        failed_logins: failedLogins || 0,
        suspicious_activity: suspiciousActivity || 0,
        blocked_ips: 0, // Would need separate tracking
        rate_limit_violations: 0, // Would need separate tracking
        admin_actions: adminActions || 0
      };

    } catch (error) {
      console.error('Failed to get security metrics:', error);
      return {
        failed_logins: 0,
        suspicious_activity: 0,
        blocked_ips: 0,
        rate_limit_violations: 0,
        admin_actions: 0
      };
    }
  }

  async checkSuspiciousActivity(userId: string, ipAddress: string): Promise<boolean> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      // Check for multiple failed attempts
      const { count: failedAttempts } = await this.supabase
        .from('security_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action', 'authentication_failed')
        .gte('created_at', oneHourAgo);

      // Check for rapid requests from same IP
      const { count: rapidRequests } = await this.supabase
        .from('security_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ipAddress)
        .gte('created_at', oneHourAgo);

      const isSuspicious = (failedAttempts || 0) > 5 || (rapidRequests || 0) > 50;

      if (isSuspicious) {
        await this.logSecurityEvent({
          user_id: userId,
          action: 'suspicious_activity_detected',
          severity: 'high',
          details: {
            failed_attempts: failedAttempts,
            rapid_requests: rapidRequests,
            detection_reason: 'automated_threshold'
          },
          ip_address: ipAddress
        });
      }

      return isSuspicious;

    } catch (error) {
      console.error('Failed to check suspicious activity:', error);
      return false;
    }
  }
}

// Convenience functions for common audit events
export async function logAdminAction(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  action: string,
  targetResource: string,
  details?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const logger = new SecurityAuditLogger(supabase);
  
  await logger.logSecurityEvent({
    admin_user_id: adminUserId,
    action,
    target_resource: targetResource,
    severity: 'medium',
    details,
    ip_address: ipAddress,
    user_agent: userAgent
  });
}

export async function logSecurityViolation(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  violation: string,
  details?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  const logger = new SecurityAuditLogger(supabase);
  
  await logger.logSecurityEvent({
    user_id: userId,
    action: violation,
    severity: 'high',
    details,
    ip_address: ipAddress,
    prevented: true
  });
}