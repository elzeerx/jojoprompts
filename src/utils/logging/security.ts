// Frontend security event logging
// Routes security events through unified logger for future remote sink integration

import { logSecurity } from './index';
import { supabase } from '@/integrations/supabase/client';

export interface SecurityEvent {
  action: string;
  resource?: string;
  success?: boolean;
  userId?: string;
  data?: any;
  ipAddress?: string;
  userAgent?: string;
}

// Security event types
export const SECURITY_EVENTS = {
  // Authentication events
  AUTH_LOGIN_ATTEMPT: 'auth.login.attempt',
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILURE: 'auth.login.failure',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_SIGNUP_ATTEMPT: 'auth.signup.attempt',
  AUTH_SIGNUP_SUCCESS: 'auth.signup.success',
  AUTH_SIGNUP_FAILURE: 'auth.signup.failure',
  AUTH_PASSWORD_RESET: 'auth.password.reset',
  AUTH_SESSION_EXPIRED: 'auth.session.expired',
  
  // Authorization events
  AUTHZ_ACCESS_DENIED: 'authz.access.denied',
  AUTHZ_PERMISSION_ESCALATION: 'authz.permission.escalation',
  AUTHZ_ROLE_CHANGE: 'authz.role.change',
  
  // Data access events
  DATA_EXPORT: 'data.export',
  DATA_SENSITIVE_ACCESS: 'data.sensitive.access',
  DATA_MODIFICATION: 'data.modification',
  
  // Security violations
  SECURITY_CSP_VIOLATION: 'security.csp.violation',
  SECURITY_SUSPICIOUS_ACTIVITY: 'security.suspicious.activity',
  SECURITY_RATE_LIMIT_EXCEEDED: 'security.rate_limit.exceeded',
  
  // Admin actions
  ADMIN_USER_DELETE: 'admin.user.delete',
  ADMIN_SUBSCRIPTION_CANCEL: 'admin.subscription.cancel',
  ADMIN_ROLE_CHANGE: 'admin.role.change',
  ADMIN_ACCESS: 'admin.access'
} as const;

// Get client IP (best effort in browser)
function getClientIP(): string {
  // In browser, we can't get real IP, but we can get some network info
  return 'client-side';
}

// Get user agent
function getUserAgent(): string {
  return navigator.userAgent.substring(0, 200);
}

// Main security logging function
export function logSecurityEvent(event: SecurityEvent): void {
  const enhancedEvent = {
    ...event,
    level: event.success === false ? 'error' as const : 'info' as const,
    message: `Security event: ${event.action}`,
    ipAddress: event.ipAddress || getClientIP(),
    userAgent: event.userAgent || getUserAgent()
  };

  // Log through unified logger
  logSecurity(enhancedEvent);

  // Also send to Supabase security_logs table (if authenticated)
  // This maintains existing behavior for audit trails
  sendToSupabaseSecurityLogs(enhancedEvent).catch(error => {
    // Don't block on security log failures, but record them
    console.warn('Failed to send security event to Supabase:', error);
  });
}

// Send to Supabase security logs (existing behavior)
async function sendToSupabaseSecurityLogs(event: SecurityEvent & { 
  ipAddress: string; 
  userAgent: string; 
}): Promise<void> {
  try {
    // Only send if user is authenticated to avoid spam
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase
      .from('security_logs')
      .insert({
        user_id: event.userId || session.user?.id,
        action: event.action,
        details: {
          resource: event.resource,
          success: event.success,
          data: event.data,
          timestamp: new Date().toISOString()
        },
        ip_address: event.ipAddress,
        user_agent: event.userAgent
      });
  } catch (error) {
    // Silently fail for security logs to avoid disrupting user experience
    console.debug('Security log to Supabase failed:', error);
  }
}

// Convenience functions for common security events
export const securityLogger = {
  // Authentication
  loginAttempt: (userId?: string, data?: any) => 
    logSecurityEvent({ 
      action: SECURITY_EVENTS.AUTH_LOGIN_ATTEMPT, 
      userId, 
      data, 
      resource: 'auth' 
    }),
  
  loginSuccess: (userId: string, data?: any) => 
    logSecurityEvent({ 
      action: SECURITY_EVENTS.AUTH_LOGIN_SUCCESS, 
      userId, 
      data, 
      success: true, 
      resource: 'auth' 
    }),
  
  loginFailure: (reason: string, data?: any) => 
    logSecurityEvent({ 
      action: SECURITY_EVENTS.AUTH_LOGIN_FAILURE, 
      data: { reason, ...data }, 
      success: false, 
      resource: 'auth' 
    }),

  logout: (userId: string) => 
    logSecurityEvent({ 
      action: SECURITY_EVENTS.AUTH_LOGOUT, 
      userId, 
      success: true, 
      resource: 'auth' 
    }),

  // Authorization
  accessDenied: (userId: string, resource: string, requiredRole?: string) => 
    logSecurityEvent({ 
      action: SECURITY_EVENTS.AUTHZ_ACCESS_DENIED, 
      userId, 
      resource, 
      data: { requiredRole }, 
      success: false 
    }),

  // Admin actions  
  adminAccess: (userId: string, resource: string) => 
    logSecurityEvent({ 
      action: SECURITY_EVENTS.ADMIN_ACCESS, 
      userId, 
      resource, 
      success: true 
    }),

  adminUserDelete: (adminId: string, targetUserId: string) => 
    logSecurityEvent({ 
      action: SECURITY_EVENTS.ADMIN_USER_DELETE, 
      userId: adminId, 
      resource: 'user', 
      data: { targetUserId }, 
      success: true 
    }),

  // Security violations
  suspiciousActivity: (activity: string, userId?: string, data?: any) => 
    logSecurityEvent({ 
      action: SECURITY_EVENTS.SECURITY_SUSPICIOUS_ACTIVITY, 
      userId, 
      data: { activity, ...data }, 
      success: false, 
      resource: 'security' 
    })
};

export default securityLogger;