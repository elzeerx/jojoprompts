// Shared admin authentication and authorization
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createSupabaseClient } from './standardImports.ts';

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
  
  // Verify the JWT token
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    console.error('Authentication failed:', userError);
    throw new Error('Invalid or expired token');
  }

  // Get user profile with role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Profile fetch failed:', profileError);
    throw new Error('User profile not found');
  }

  // Verify admin privileges
  const userRole = profile.role;
  if (!['admin', 'jadmin'].includes(userRole)) {
    throw new Error('Insufficient privileges. Admin access required.');
  }

  // Get role-based permissions
  const permissions = ROLE_PERMISSIONS[userRole as keyof typeof ROLE_PERMISSIONS] || [];

  return {
    supabase,
    userId: user.id,
    userRole,
    permissions
  };
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
    console.warn('Failed to log security event:', error);
  }
}