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
    // Fetch user profile with comprehensive security checks
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('role, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      logger.error('Error fetching user profile', { error: profileError.message });
      return {
        profile: null, 
        permissions: [], 
        isValid: false, 
        error: `Database error: ${profileError.message}` 
      };
    }

    if (!profile) {
      logger.error('No profile found for user', { userId: user.id });
      return {
        profile: null, 
        permissions: [], 
        isValid: false, 
        error: 'User profile not found' 
      };
    }

    // Enhanced admin role validation
    const adminRoles = ['admin', 'jadmin'];
    const userRole = profile.role?.toLowerCase();
    
    if (!adminRoles.includes(userRole)) {
      logger.error('Auth failure - insufficient role', {
        userId: user.id,
        email: user.email,
        actualRole: profile.role,
        requiredRoles: adminRoles.join(', '),
        profile: JSON.stringify(profile)
      });
      
      // Log potential privilege escalation attempt
      await logSecurityEvent(serviceClient, {
        user_id: user.id,
        action: 'unauthorized_admin_access_attempt',
        details: { 
          attemptedRole: userRole,
          requiredRoles: adminRoles,
          endpoint: 'get-all-users',
          userEmail: user.email,
          profileCreated: profile.created_at
        }
      });
      
      return { 
        profile: null, 
        permissions: [], 
        isValid: false, 
        error: `Access denied: User role is '${profile.role}', requires 'admin' or 'jadmin' role` 
      };
    }

    // Generate role-based permissions
    const permissions = generatePermissions(userRole);

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
