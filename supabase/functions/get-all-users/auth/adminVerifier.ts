import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import type { AuthContext } from '../../_shared/adminAuth.ts';
import { logSecurityEvent } from '../../_shared/adminAuth.ts';
import { createEdgeLogger } from '../../_shared/logger.ts';
import { validateEnvironment } from './environmentValidator.ts';
import { parseAuthHeader } from './authHeaderParser.ts';
import { validateToken } from './tokenValidator.ts';
import { verifyProfile } from './profileVerifier.ts';

const logger = createEdgeLogger('get-all-users:auth:admin-verifier');

/**
 * Enhanced auth logic for admin functions with comprehensive security:
 * 1. Validate the bearer token (user JWT) with proper error handling
 * 2. Create service role client only after successful authentication
 * 3. Verify admin privileges with strict role checking
 * 4. Implement security logging and monitoring
 * 5. Generate role-based permissions for fine-grained access control
 */
export async function verifyAdmin(req: Request): Promise<AuthContext> {
  // Step 1: Validate environment variables
  const envConfig = validateEnvironment();
  if (!envConfig.isValid) {
    throw new Error(envConfig.error);
  }

  const { supabaseUrl, serviceRoleKey, anonKey } = envConfig;

  // Step 2: Extract and validate JWT from header
  const authResult = parseAuthHeader(req);
  if (!authResult.isValid) {
    throw new Error(`Unauthorized - ${authResult.error}`);
  }

  const { token } = authResult;

  try {
    // Step 3: Validate user token
    const tokenResult = await validateToken(token, supabaseUrl, anonKey);
    if (!tokenResult.isValid) {
      throw new Error(`Unauthorized - ${tokenResult.error}`);
    }

    const { user } = tokenResult;

    // Step 4: Create service role client for privileged operations
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Step 5: Verify profile and admin privileges
    const profileResult = await verifyProfile(serviceClient, user);
    if (!profileResult.isValid) {
      throw new Error(`Forbidden - ${profileResult.error}`);
    }

    const { profile, permissions } = profileResult;

    // Step 6: Log successful authentication
    logger.info('Successfully authenticated admin user', { userId: user.id, role: profile.role });
    
    await logSecurityEvent(serviceClient, {
      user_id: user.id,
      action: 'admin_function_access_granted',
      details: { 
        function: 'get-all-users', 
        success: true,
        role: profile.role,
        permissions: permissions
      }
    });

    return { 
      supabase: serviceClient, 
      userId: user.id,
      userRole: profile.role,
      permissions
    };

  } catch (error: any) {
    // Enhanced error logging with security context
    logger.error('Authentication failed', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent')?.substring(0, 200),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer'),
      hasAuthHeader: !!req.headers.get('authorization')
    });
    
    // Re-throw with more detailed error message
    if (error.message.includes('Unauthorized')) {
      throw new Error(`Unauthorized: ${error.message}`);
    } else if (error.message.includes('Forbidden') || error.message.includes('Access denied')) {
      throw new Error(`Forbidden: ${error.message}`);
    } else {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }
}
