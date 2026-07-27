// Frontend security event logging.
//
// PRE-LAUNCH HARDENING (2026-07-27): the browser-side INSERT into
// public.security_logs has been removed. Live migration
// 20260727135637 (system_log_rls_hardening) tightened writes on
// system/log tables; only service_role and admin-scoped server code
// should write to security_logs. This module keeps the same public
// API so existing callers (LoginForm, admin audit hooks) continue to
// route events through the unified logger and (in the future) a
// remote sink, but nothing here touches Supabase directly.

import { logSecurity } from './index';

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
  VIOLATION_SUSPICIOUS_ACTIVITY: 'violation.suspicious.activity',
  VIOLATION_RATE_LIMIT: 'violation.rate.limit',
  VIOLATION_INVALID_INPUT: 'violation.invalid.input',
  VIOLATION_XSS_ATTEMPT: 'violation.xss.attempt',
  VIOLATION_CSRF_ATTEMPT: 'violation.csrf.attempt',
} as const;

function getIP(): string { return 'client'; }
function getUserAgent(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
}

export function logSecurityEvent(event: SecurityEvent): void {
  const enhancedEvent = {
    ...event,
    ipAddress: event.ipAddress || getIP(),
    userAgent: event.userAgent || getUserAgent(),
  };

  // Route through unified logger only. No client-role DB writes.
  logSecurity({
    level: event.success === false ? 'warn' : 'info',
    message: event.action,
    action: enhancedEvent.action,
    resource: enhancedEvent.resource,
    success: enhancedEvent.success,
    userId: enhancedEvent.userId,
    data: enhancedEvent.data,
    ipAddress: enhancedEvent.ipAddress,
    userAgent: enhancedEvent.userAgent,
  });
}

// Convenience API — preserved for existing callers.
export const securityLogger = {
  loginAttempt: (userId?: string, data?: any) =>
    logSecurityEvent({ action: SECURITY_EVENTS.AUTH_LOGIN_ATTEMPT, userId, data, resource: 'auth' }),
  loginSuccess: (userId: string, data?: any) =>
    logSecurityEvent({ action: SECURITY_EVENTS.AUTH_LOGIN_SUCCESS, userId, data, success: true, resource: 'auth' }),
  loginFailure: (reason: string, data?: any) =>
    logSecurityEvent({ action: SECURITY_EVENTS.AUTH_LOGIN_FAILURE, success: false, data: { reason, ...data }, resource: 'auth' }),
  logout: (userId: string) =>
    logSecurityEvent({ action: SECURITY_EVENTS.AUTH_LOGOUT, userId, resource: 'auth' }),
  signupAttempt: (data?: any) =>
    logSecurityEvent({ action: SECURITY_EVENTS.AUTH_SIGNUP_ATTEMPT, data, resource: 'auth' }),
  signupSuccess: (userId: string, data?: any) =>
    logSecurityEvent({ action: SECURITY_EVENTS.AUTH_SIGNUP_SUCCESS, userId, data, success: true, resource: 'auth' }),
  signupFailure: (reason: string, data?: any) =>
    logSecurityEvent({ action: SECURITY_EVENTS.AUTH_SIGNUP_FAILURE, success: false, data: { reason, ...data }, resource: 'auth' }),
  passwordReset: (userId?: string, data?: any) =>
    logSecurityEvent({ action: SECURITY_EVENTS.AUTH_PASSWORD_RESET, userId, data, resource: 'auth' }),
  accessDenied: (userId?: string, resource?: string, data?: any) =>
    logSecurityEvent({ action: SECURITY_EVENTS.AUTHZ_ACCESS_DENIED, userId, resource, data, success: false }),
  suspiciousActivity: (userId?: string, data?: any) =>
    logSecurityEvent({ action: SECURITY_EVENTS.VIOLATION_SUSPICIOUS_ACTIVITY, userId, data }),
  rateLimit: (userId?: string, data?: any) =>
    logSecurityEvent({ action: SECURITY_EVENTS.VIOLATION_RATE_LIMIT, userId, data }),
};
