
// Enhanced Admin Authentication System
import { supabase } from '@/integrations/supabase/client';
import { logError, logWarn, logInfo } from '../secureLogging';
import { SecurityEnforcer } from '../enhancedSecurity';
import { InputValidator } from '../inputValidation';

interface AdminAuthResult {
  isAuthenticated: boolean;
  userId?: string;
  role?: string;
  permissions: string[];
  error?: string;
}

export class AdminAuthenticator {
  // Enhanced admin authentication with privilege separation
  static async authenticateAdmin(token?: string): Promise<AdminAuthResult> {
    try {
      // Step 1: Validate session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        logError('Session validation failed', 'admin_auth', { error: sessionError.message });
        return { isAuthenticated: false, permissions: [], error: 'Session validation failed' };
      }

      if (!session?.user) {
        logWarn('No active session found', 'admin_auth');
        return { isAuthenticated: false, permissions: [], error: 'No active session' };
      }

      // Step 2: Validate session integrity
      if (!SecurityEnforcer.validateSessionIntegrity(session)) {
        logError('Session integrity check failed', 'admin_auth', { userId: session.user.id });
        return { isAuthenticated: false, permissions: [], error: 'Invalid session' };
      }

      const userId = session.user.id;

      // Step 3: Fetch and validate user role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        logError('Profile fetch failed', 'admin_auth', { 
          error: profileError.message, 
          userId 
        });
        return { isAuthenticated: false, permissions: [], error: 'Profile access denied' };
      }

      if (!profile) {
        logWarn('No profile found for user', 'admin_auth', { userId });
        return { isAuthenticated: false, permissions: [], error: 'Profile not found' };
      }

      // Step 4: Validate admin role
      const role = profile.role;
      if (!this.isAdminRole(role)) {
        logWarn('Non-admin access attempt', 'admin_auth', { userId, role });
        return { 
          isAuthenticated: false, 
          permissions: [], 
          error: 'Administrative privileges required' 
        };
      }

      // Step 5: Generate role-based permissions
      const permissions = this.generatePermissions(role);

      // Step 6: Log successful authentication
      logInfo('Admin authentication successful', 'admin_auth', { userId, role });

      return {
        isAuthenticated: true,
        userId,
        role,
        permissions
      };

    } catch (error) {
      logError('Admin authentication error', 'admin_auth', { error: String(error) });
      return { 
        isAuthenticated: false, 
        permissions: [], 
        error: 'Authentication service error' 
      };
    }
  }

  // Validate admin roles with strict checking
  private static isAdminRole(role: string): boolean {
    const adminRoles = ['admin', 'jadmin']; // Define allowed admin roles
    return adminRoles.includes(role?.toLowerCase());
  }

  // Generate role-based permissions
  private static generatePermissions(role: string): string[] {
    const permissions: string[] = [];

    switch (role?.toLowerCase()) {
      case 'admin':
        permissions.push(
          'user:read', 'user:write', 'user:delete',
          'subscription:read', 'subscription:write', 'subscription:cancel',
          'transaction:read', 'transaction:write',
          'prompt:read', 'prompt:write', 'prompt:delete',
          'system:audit', 'system:config'
        );
        break;
      case 'jadmin':
        permissions.push(
          'user:read', 'subscription:read', 'transaction:read',
          'prompt:read', 'prompt:write'
        );
        break;
      default:
        // No permissions for non-admin roles
        break;
    }

    return permissions;
  }

  // Check specific permission
  static hasPermission(permissions: string[], requiredPermission: string): boolean {
    return permissions.includes(requiredPermission);
  }

  // Audit admin actions using direct table insert
  static async auditAdminAction(
    userId: string,
    action: string,
    targetResource: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Use direct table insert for audit logging
      const { error } = await supabase
        .from('admin_audit_log')
        .insert({
          admin_user_id: userId,
          action,
          target_resource: targetResource,
          metadata: metadata || {},
          timestamp: new Date().toISOString(),
          ip_address: 'client-side'
        });

      if (error) {
        logError('Failed to audit admin action', 'admin_audit', {
          error: error.message,
          userId,
          action
        });
      } else {
        logInfo('Admin action audited', 'admin_audit', {
          userId,
          action,
          targetResource
        });
      }
    } catch (error) {
      logError('Failed to audit admin action', 'admin_audit', {
        error: String(error),
        userId,
        action
      });
    }
  }
}
