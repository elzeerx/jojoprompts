import { createEdgeLogger } from '../../_shared/logger.ts';
import { generatePermissions } from './permissionManager.ts';
import { performSecurityChecks } from './securityChecks.ts';
import { logSecurityEvent } from '../../shared/securityLogger.ts';

const logger = createEdgeLogger('get-all-users:auth:profile-verifier');

export interface ProfileVerificationResult {
  profile: any;
  permissions: string[];
  isValid: boolean;
  error?: string;
}

/**
 * Enhanced profile verification with comprehensive security checks
 */
export async function verifyProfile(
  serviceClient: any,
  user: any
): Promise<ProfileVerificationResult> {
  try {
    // Fetch user role from user_roles table with comprehensive security checks
    const { data: userRoleData, error: roleError } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'jadmin'])
      .maybeSingle();

    if (roleError) {
      logger.error('Error fetching user role', { error: roleError.message });
      return {
        profile: null, 
        permissions: [], 
        isValid: false, 
        error: `Database error: ${roleError.message}` 
      };
    }

    if (!userRoleData) {
      logger.error('Auth failure - user has no admin role', {
        userId: user.id,
        email: user.email
      });
      
      // Log potential privilege escalation attempt
      await logSecurityEvent(serviceClient, {
        user_id: user.id,
        action: 'unauthorized_admin_access_attempt',
        details: { 
          attemptedAccess: 'get-all-users',
          requiredRoles: ['admin', 'jadmin'],
          endpoint: 'get-all-users',
          userEmail: user.email
        }
      });
      
      return { 
        profile: null, 
        permissions: [], 
        isValid: false, 
        error: `Access denied: User does not have admin or jadmin role` 
      };
    }

    const userRole = userRoleData.role.toLowerCase();

    // Generate role-based permissions
    const permissions = generatePermissions(userRole);

    // Create a profile object for compatibility
    const profile = {
      role: userRole,
      created_at: null
    };

    // Additional security checks
    await performSecurityChecks({ supabase: serviceClient, userId: user.id, profile });

    return { profile, permissions, isValid: true };
  } catch (error: any) {
    logger.error('Profile verification error', { error: error.message });
    return {
      profile: null, 
      permissions: [], 
      isValid: false, 
      error: 'Profile verification failed' 
    };
  }
}
