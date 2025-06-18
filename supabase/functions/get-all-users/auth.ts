
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  userRole: string;
  permissions: string[];
}

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
    await performSecurityChecks(serviceClient, user.id, profile);

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

// Generate role-based permissions
function generatePermissions(role: string): string[] {
  const permissions: string[] = [];

  switch (role) {
    case 'admin':
      permissions.push(
        'user:read', 'user:write', 'user:delete',
        'subscription:read', 'subscription:write', 'subscription:cancel',
        'transaction:read', 'transaction:write',
        'system:audit', 'system:config'
      );
      break;
    case 'jadmin':
      permissions.push(
        'user:read', 'subscription:read', 'transaction:read'
      );
      break;
  }

  return permissions;
}

// Perform additional security checks
async function performSecurityChecks(
  supabase: any, 
  userId: string, 
  profile: any
): Promise<void> {
  try {
    // Check for recent suspicious activity
    const { data: recentActivity, error } = await supabase
      .from('security_logs')
      .select('action, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.warn('Failed to check recent activity:', error.message);
      return; // Don't block on this check
    }

    // Check for multiple failed attempts
    const failedAttempts = recentActivity?.filter(
      log => log.action === 'admin_function_access_denied'
    ).length || 0;

    if (failedAttempts >= 5) {
      console.warn(`High number of failed admin access attempts for user ${userId}`);
      await logSecurityEvent(supabase, {
        user_id: userId,
        action: 'suspicious_admin_activity_detected',
        details: { failedAttempts, timeWindow: '24h' }
      });
    }

  } catch (error) {
    console.warn('Security checks failed:', error);
    // Don't throw - these are supplementary checks
  }
}

// Enhanced security event logging
async function logSecurityEvent(
  supabase: any, 
  event: {
    user_id: string;
    action: string;
    details: Record<string, any>;
  }
): Promise<void> {
  try {
    await supabase
      .from('security_logs')
      .insert({
        ...event,
        created_at: new Date().toISOString(),
        ip_address: 'edge-function', // Would be actual IP in production
        user_agent: 'supabase-edge-function'
      });
  } catch (error) {
    console.warn('Failed to log security event:', error);
    // Don't throw - logging failures shouldn't block operations
  }
}

// Enhanced request validation with security focus
export function validateAdminRequest(req: Request): { isValid: boolean; error?: string } {
  try {
    // Enhanced method validation
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    if (!allowedMethods.includes(req.method)) {
      return { isValid: false, error: 'Invalid request method' };
    }

    // Enhanced content type validation
    if (['POST', 'PUT'].includes(req.method)) {
      const contentType = req.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return { isValid: false, error: 'Invalid content type - application/json required' };
      }
    }

    // Enhanced header validation
    const requiredHeaders = ['authorization'];
    for (const header of requiredHeaders) {
      const headerValue = req.headers.get(header);
      if (!headerValue) {
        return { isValid: false, error: `Missing required header: ${header}` };
      }
      
      // Additional header value validation
      if (header === 'authorization') {
        if (!headerValue.startsWith('Bearer ') || headerValue.length < 20) {
          return { isValid: false, error: 'Invalid authorization header format' };
        }
      }
    }

    // Enhanced user agent validation
    const userAgent = req.headers.get('user-agent');
    if (!userAgent || userAgent.length < 5 || userAgent.length > 500) {
      return { isValid: false, error: 'Invalid or suspicious user agent' };
    }

    // Check for suspicious patterns in headers
    const suspiciousPatterns = [
      /script/i, /javascript/i, /vbscript/i, /<[^>]*>/,
      /union.*select/i, /drop.*table/i, /exec\(/i
    ];

    for (const [headerName, headerValue] of req.headers.entries()) {
      if (typeof headerValue === 'string') {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(headerValue)) {
            console.warn('Suspicious header content detected', { headerName, pattern: pattern.toString() });
            return { isValid: false, error: 'Suspicious request content detected' };
          }
        }
      }
    }

    // URL validation
    const url = new URL(req.url);
    if (url.pathname.includes('..') || url.pathname.includes('%')) {
      return { isValid: false, error: 'Invalid URL path' };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Request validation error:', error);
    return { isValid: false, error: 'Request validation failed' };
  }
}

// Check if user has specific permission
export function hasPermission(permissions: string[], requiredPermission: string): boolean {
  return permissions.includes(requiredPermission);
}
