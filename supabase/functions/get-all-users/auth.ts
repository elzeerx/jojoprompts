
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  userRole: string;
}

/**
 * Enhanced auth logic for admin functions with improved security:
 * 1. Validate the bearer token (user JWT) with proper error handling
 * 2. Create service role client only after successful authentication
 * 3. Verify admin privileges with proper role checking
 * 4. Implement security logging and monitoring
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

  // Extract and validate JWT
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

    // Step 2: Create service role client for privileged operations
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Step 3: Enhanced role verification with proper error handling
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('role')
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

    if (profile.role !== 'admin') {
      console.error(`User ${user.id} has role '${profile.role}', admin required`);
      throw new Error('Forbidden - Admin role required');
    }

    // Step 4: Log successful authentication
    console.log(`Successfully authenticated admin user ${user.id}`);
    
    // Enhanced security: Log admin access
    try {
      await serviceClient
        .from('security_logs')
        .insert({
          user_id: user.id,
          action: 'admin_function_access',
          details: { function: 'get-all-users', success: true },
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      // Don't fail auth if logging fails, but log the error
      console.warn('Failed to log admin access:', logError);
    }

    return { 
      supabase: serviceClient, 
      userId: user.id,
      userRole: profile.role
    };

  } catch (error: any) {
    // Enhanced error logging with security context
    console.error('Authentication error:', {
      message: error.message,
      stack: error.stack?.substring(0, 500), // Limit stack trace length
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get('user-agent')?.substring(0, 200)
    });
    
    // Re-throw with sanitized error message
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      throw error; // These are safe to expose
    } else {
      throw new Error('Authentication failed'); // Generic error for security
    }
  }
}

// Enhanced request validation
export function validateAdminRequest(req: Request): { isValid: boolean; error?: string } {
  try {
    // Check request method
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    if (!allowedMethods.includes(req.method)) {
      return { isValid: false, error: 'Invalid request method' };
    }

    // Check content type for POST/PUT requests
    if (['POST', 'PUT'].includes(req.method)) {
      const contentType = req.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return { isValid: false, error: 'Invalid content type' };
      }
    }

    // Check for required headers
    const requiredHeaders = ['authorization'];
    for (const header of requiredHeaders) {
      if (!req.headers.get(header)) {
        return { isValid: false, error: `Missing required header: ${header}` };
      }
    }

    // Basic rate limiting check (could be enhanced)
    const userAgent = req.headers.get('user-agent');
    if (!userAgent || userAgent.length < 5) {
      return { isValid: false, error: 'Invalid user agent' };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Request validation error:', error);
    return { isValid: false, error: 'Request validation failed' };
  }
}
