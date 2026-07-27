// Legacy client-side security logger — DB writes REMOVED (2026-07-27
// pre-launch hardening). Live migration 20260727135637 revoked
// authenticated INSERT on public.security_logs. Any remaining callers
// (e.g. RouteGuard) still receive their console warn/error signal
// through the console fallback below, but no browser code inserts
// into security_logs anymore. Server-side logging paths are unchanged.
//
// Kept as a compatibility shim so existing imports continue to compile.
// New code should use `securityLogger` from '@/utils/logging/security'.

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
  async logRouteAccess(_data: RouteAccessLog): Promise<void> {
    // No-op: browser must not INSERT into public.security_logs.
  }

  async logUnauthorizedAccess(data: UnauthorizedAccessLog): Promise<void> {
    // Preserve console visibility for immediate debugging; no DB write.
    console.warn('Unauthorized access attempt:', {
      path: data.path,
      userRole: data.userRole,
      requiredRole: data.requiredRole,
      reason: data.reason,
    });
  }

  async logSecurityEvent(_data: SecurityEvent): Promise<void> {
    // No-op: browser must not INSERT into public.security_logs.
  }

  async logSuspiciousActivity(
    userId: string,
    activity: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    console.error('SUSPICIOUS ACTIVITY DETECTED:', { userId, activity, metadata });
  }

  async logRateLimitExceeded(
    _userId: string,
    _resource: string,
    _attempts: number,
  ): Promise<void> {
    // No-op.
  }
}

export const securityLogger = new SecurityLogger();
