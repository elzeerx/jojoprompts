
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
}

/**
 * Auth logic for the admin functions:
 * 1. Validate the bearer token (user JWT) with the anon key (not service role).
 * 2. If user is found, create a new supabase client with the service role for admin DB & admin API calls.
 */
export async function verifyAdmin(req: Request): Promise<AuthContext> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;

  // Extract JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error('Missing Authorization header');
    throw new Error('Unauthorized - Missing authorization header');
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    console.error('Invalid Authorization header format');
    throw new Error('Unauthorized - Invalid authorization format');
  }

  try {
    // Validate user token with anon key! Not with service role.
    const anonClient = createClient(supabaseUrl, anonKey);
    console.log(`Validating user JWT via anon client...`);
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Error validating token via anon client:', userError);
      throw new Error(`Unauthorized - Invalid token: ${userError?.message || 'User not found'}`);
    }

    // Now role check using profiles table via service role
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching user profile in admin context:', profileError);
      throw new Error(`Error fetching user profile: ${profileError.message}`);
    }

    if (!profile || profile.role !== 'admin') {
      console.error(`User ${user.id} is not an admin. Role: ${profile?.role || 'unknown'}`);
      throw new Error('Forbidden - Admin role required');
    }

    // Success: use service role for all further DB operations
    console.log(`Authenticated request as ADMIN user ${user.id}, access granted`);
    return { supabase: serviceClient, userId: user.id };

  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}
