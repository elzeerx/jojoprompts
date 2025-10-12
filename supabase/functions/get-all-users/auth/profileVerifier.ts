
import { generatePermissions } from './permissionManager.ts';
import { performSecurityChecks } from './securityChecks.ts';
import { logSecurityEvent } from '../../shared/securityLogger.ts';

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
      console.error('Error fetching user profile:', profileError.message);
      return { 
        profile: null, 
        permissions: [], 
        isValid: false, 
        error: `Database error: ${profileError.message}` 
      };
    }

    if (!profile) {
      console.error(`No profile found for user ${user.id}`);
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
      const errorDetail = `User ${user.id} (${user.email}) has role '${profile.role}', admin/jadmin required`;
      console.error(`[AUTH FAILURE] ${errorDetail}`);
      console.error(`[AUTH FAILURE] Required roles: ${adminRoles.join(', ')}`);
      console.error(`[AUTH FAILURE] User role: ${userRole}`);
      console.error(`[AUTH FAILURE] Profile data:`, JSON.stringify(profile));
      
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
    console.error('Profile verification error:', error.message);
    return { 
      profile: null, 
      permissions: [], 
      isValid: false, 
      error: 'Profile verification failed' 
    };
  }
}
