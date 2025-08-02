import { supabase } from "@/integrations/supabase/client";

interface RouteAccessLog {
  path: string;
  userRole: string;
  userId?: string;
  requiredRole?: string;
  requiredPermissions?: string[];
}

interface UnauthorizedAccessLog {
  path: string;
  userRole: string;
  userId: string;
  requiredRole?: string;
  requiredPermissions?: string[];
  reason: string;
}

interface SecurityEvent {
  action: string;
  userId?: string;
  details: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
}

class SecurityLogger {
  private async getClientInfo() {
    return {
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      referrer: document.referrer || undefined
    };
  }

  async logRouteAccess(data: RouteAccessLog) {
    try {
      const clientInfo = await this.getClientInfo();
      
      await supabase.from('security_logs').insert({
        action: 'route_access',
        user_id: data.userId || null,
        user_agent: clientInfo.userAgent,
        details: {
          path: data.path,
          user_role: data.userRole,
          required_role: data.requiredRole,
          required_permissions: data.requiredPermissions,
          timestamp: clientInfo.timestamp,
          referrer: clientInfo.referrer
        }
      });
    } catch (error) {
      console.warn('Failed to log route access:', error);
    }
  }

  async logUnauthorizedAccess(data: UnauthorizedAccessLog) {
    try {
      const clientInfo = await this.getClientInfo();
      
      await supabase.from('security_logs').insert({
        action: 'unauthorized_access_attempt',
        user_id: data.userId,
        user_agent: clientInfo.userAgent,
        details: {
          path: data.path,
          user_role: data.userRole,
          required_role: data.requiredRole,
          required_permissions: data.requiredPermissions,
          reason: data.reason,
          timestamp: clientInfo.timestamp,
          severity: 'medium'
        }
      });

      // Also log to console for immediate debugging
      console.warn('Unauthorized access attempt:', {
        path: data.path,
        userRole: data.userRole,
        requiredRole: data.requiredRole,
        reason: data.reason
      });
    } catch (error) {
      console.error('Failed to log unauthorized access:', error);
    }
  }

  async logSecurityEvent(data: SecurityEvent) {
    try {
      const clientInfo = await this.getClientInfo();
      
      await supabase.from('security_logs').insert({
        action: data.action,
        user_id: data.userId || null,
        user_agent: data.userAgent || clientInfo.userAgent,
        ip_address: data.ipAddress,
        details: {
          ...data.details,
          timestamp: clientInfo.timestamp
        }
      });
    } catch (error) {
      console.warn('Failed to log security event:', error);
    }
  }

  async logSuspiciousActivity(userId: string, activity: string, metadata?: Record<string, any>) {
    try {
      await this.logSecurityEvent({
        action: 'suspicious_activity',
        userId,
        details: {
          activity,
          severity: 'high',
          ...metadata
        }
      });

      // Log to console for immediate attention
      console.error('SUSPICIOUS ACTIVITY DETECTED:', {
        userId,
        activity,
        metadata
      });
    } catch (error) {
      console.error('Failed to log suspicious activity:', error);
    }
  }

  async logRateLimitExceeded(userId: string, resource: string, attempts: number) {
    try {
      await this.logSecurityEvent({
        action: 'rate_limit_exceeded',
        userId,
        details: {
          resource,
          attempts,
          severity: 'medium',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.warn('Failed to log rate limit violation:', error);
    }
  }
}

export const securityLogger = new SecurityLogger();