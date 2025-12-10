// Shared admin authentication and authorization
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createSupabaseClient } from './standardImports.ts';
import { createEdgeLogger } from './logger.ts';

const logger = createEdgeLogger('ADMIN_AUTH');

export interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  userRole: string;
  permissions: string[];
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Role-based permissions mapping
const ROLE_PERMISSIONS = {
  admin: ['user:read', 'user:write', 'user:delete', 'subscription:manage', 'system:admin'],
  jadmin: ['user:read', 'user:write', 'subscription:manage'],
  prompter: ['user:read'],
  user: []
};

export function validateAdminRequest(req: Request): ValidationResult {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { isValid: false, error: 'Missing authorization header' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'Invalid authorization format' };
  }

  return { isValid: true };
}

export async function verifyAdmin(req: Request): Promise<AuthContext> {
  const supabase = createSupabaseClient();
  
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('No authorization header provided');
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Enhanced token validation
  if (!token || token.length < 10) {
    throw new Error('Invalid token format');
  }

  try {
    // Verify the JWT token with retry logic
    let user = null;
    let userError = null;
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { data, error } = await supabase.auth.getUser(token);
      user = data?.user;
      userError = error;
      
      if (!userError && user) break;
      
      if (attempt === 1) {
        logger.warn('Token validation retry', { attempt });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (userError || !user) {
      logger.error('Authentication failed', { error: userError?.message });
      throw new Error('Invalid or expired token');
    }

    // Enhanced user validation
    if (!user.email || !user.email_confirmed_at) {
      logger.error('Email not confirmed', { userId: user.id });
      throw new Error('Email verification required');
    }

    // Get user role using new secure user_roles system
    // Check if user has admin or jadmin role using security definer function
    const { data: hasAdmin, error: adminCheckError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });
    
    const { data: hasJadmin, error: jadminCheckError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'jadmin'
    });
    
    if (adminCheckError || jadminCheckError) {
      logger.error('Role check failed', { adminCheckError, jadminCheckError });
      throw new Error('Failed to verify user role');
    }

    // User must have either admin or jadmin role
    if (!hasAdmin && !hasJadmin) {
      logger.error('Unauthorized admin access attempt', { userId: user.id });
      throw new Error('Insufficient privileges. Admin access required.');
    }

    // Determine the actual role for permission assignment
    const userRole = hasAdmin ? 'admin' : 'jadmin';

    // Get role-based permissions
    const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || [];

    return {
      supabase,
      userId: user.id,
      userRole,
      permissions
    };
  } catch (error: any) {
    logger.error('Admin verification failed', { error: error.message });
    // Re-throw with original message for better debugging
    throw error;
  }
}

export function hasPermission(permissions: string[], requiredPermission: string): boolean {
  return permissions.includes(requiredPermission);
}

export async function logSecurityEvent(
  supabase: ReturnType<typeof createClient>, 
  event: {
    user_id?: string;
    action: string;
    details?: any;
    ip_address?: string;
    user_agent?: string;
  }
) {
  try {
    await supabase
      .from('security_logs')
      .insert({
        user_id: event.user_id,
        action: event.action,
        details: event.details || {},
        ip_address: event.ip_address,
        user_agent: event.user_agent
      });
  } catch (error) {
    logger.warn('Failed to log security event', { error });
  }
}