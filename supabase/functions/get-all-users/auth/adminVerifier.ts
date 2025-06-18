
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { AuthContext } from './types.ts';
import { generatePermissions } from './permissionManager.ts';
import { performSecurityChecks } from './securityChecks.ts';
import { logSecurityEvent } from './securityLogger.ts';

/**
 * Enhanced auth logic for admin functions with comprehensive security:
 * 1. Validate the bearer token (user JWT) with proper error handling
 * 2. Create service role client only after successful authentication
 * 3. Verify admin privileges with strict role checking
 * 4. Implement security logging and monitoring
 * 5. Generate role-based permissions for fine-grained access control
 */
export async function verifyAdmin(req: Request): Promise<AuthContext> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;

  // Validate environment variables
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error('Missing required environment variables');
    throw new Error('Server configuration error');
  }

  // Extract and validate JWT with enhanced security
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Missing or invalid Authorization header format');
    throw new Error('Unauthorized - Missing or invalid authorization header');
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  if (!token || token.length < 10) {
    console.error('Invalid token format or length');
    throw new Error('Unauthorized - Invalid token format');
  }

  // Enhanced token validation
  if (!/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(token)) {
    console.error('Token format validation failed');
    throw new Error('Unauthorized - Invalid token structure');
  }

  try {
    // Step 1: Validate user token with anon client
    const anonClient = createClient(supabaseUrl, anonKey);
    console.log('Validating user JWT via anon client...');
    
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);

    if (userError) {
      console.error('Token validation failed:', userError.message);
      throw new Error(`Unauthorized - Token validation failed: ${userError.message}`);
    }

    if (!user || !user.id) {
      console.error('No user found for provided token');
      throw new Error('Unauthorized - Invalid user token');
    }

    // Enhanced user validation
    if (!user.email || !user.email_confirmed_at) {
      console.error('User email not confirmed', { userId: user.id });
      throw new Error('Forbidden - Email verification required');
    }

    // Step 2: Create service role client for privileged operations
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Step 3: Enhanced role verification with comprehensive security checks
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('role, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching user profile:', profileError.message);
      throw new Error(`Database error: ${profileError.message}`);
    }

    if (!profile) {
      console.error(`No profile found for user ${user.id}`);
      throw new Error('Forbidden - User profile not found');
    }

    // Enhanced admin role validation
    const adminRoles = ['admin', 'jadmin'];
    const userRole = profile.role?.toLowerCase();
    
    if (!adminRoles.includes(userRole)) {
      console.error(`User ${user.id} has role '${profile.role}', admin required`);
      
      // Log potential privilege escalation attempt
      await logSecurityEvent(serviceClient, {
        user_id: user.id,
        action: 'unauthorized_admin_access_attempt',
        details: { 
          attemptedRole: userRole,
          requiredRoles: adminRoles,
          endpoint: 'get-all-users'
        }
      });
      
      throw new Error('Forbidden - Administrative privileges required');
    }

    // Step 4: Generate role-based permissions
    const permissions = generatePermissions(userRole);

    // Step 5: Additional security checks
    await performSecurityChecks({ supabase: serviceClient, userId: user.id, profile });

    // Step 6: Log successful authentication with enhanced details
    console.log(`Successfully authenticated admin user ${user.id} with role ${userRole}`);
    
    await logSecurityEvent(serviceClient, {
      user_id: user.id,
      action: 'admin_function_access_granted',
      details: { 
        function: 'get-all-users', 
        success: true,
        role: userRole,
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
    console.error('Authentication error:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent')?.substring(0, 200),
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer')
    });
    
    // Re-throw with sanitized error message
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      throw error; // These are safe to expose
    } else {
      throw new Error('Authentication failed'); // Generic error for security
    }
  }
}
