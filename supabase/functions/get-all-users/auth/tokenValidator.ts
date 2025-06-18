
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

export interface TokenValidationResult {
  user: any;
  isValid: boolean;
  error?: string;
}

/**
 * Enhanced token validation with comprehensive security checks
 */
export async function validateToken(token: string, supabaseUrl: string, anonKey: string): Promise<TokenValidationResult> {
  // Enhanced token validation
  if (!/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(token)) {
    console.error('Token format validation failed');
    return { user: null, isValid: false, error: 'Invalid token structure' };
  }

  try {
    // Validate user token with anon client
    const anonClient = createClient(supabaseUrl, anonKey);
    console.log('Validating user JWT via anon client...');
    
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);

    if (userError) {
      console.error('Token validation failed:', userError.message);
      return { user: null, isValid: false, error: `Token validation failed: ${userError.message}` };
    }

    if (!user || !user.id) {
      console.error('No user found for provided token');
      return { user: null, isValid: false, error: 'Invalid user token' };
    }

    // Enhanced user validation
    if (!user.email || !user.email_confirmed_at) {
      console.error('User email not confirmed', { userId: user.id });
      return { user: null, isValid: false, error: 'Email verification required' };
    }

    return { user, isValid: true };
  } catch (error: any) {
    console.error('Token validation error:', error.message);
    return { user: null, isValid: false, error: 'Token validation failed' };
  }
}
