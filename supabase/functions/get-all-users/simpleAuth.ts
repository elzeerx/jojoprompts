import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface SimpleAuthContext {
  supabase: any;
  userId: string;
  userEmail: string | undefined;
}

/**
 * Simplified admin verification using new secure user_roles system
 * No more complex auth chains - just verify JWT and check role via security definer function
 */
export async function verifyAdminSimple(req: Request): Promise<SimpleAuthContext> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[AUTH ERROR] Missing environment variables');
    throw new Error('Server configuration error');
  }
  
  // Get JWT from header
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[AUTH ERROR] Missing or invalid authorization header');
    throw new Error('UNAUTHORIZED');
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  // Create service role client
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  
  // Verify token and get user
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    console.error('[AUTH ERROR] Invalid or expired token:', userError?.message);
    throw new Error('UNAUTHORIZED');
  }
  
  console.log(`[AUTH] Token validated for user: ${user.id} (${user.email})`);
  
  // Check if user has admin role using new secure system
  const { data: hasAdmin, error: adminCheckError } = await supabase.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin'
  });
  
  const { data: hasJadmin, error: jadminCheckError } = await supabase.rpc('has_role', {
    _user_id: user.id,
    _role: 'jadmin'
  });
  
  if (adminCheckError || jadminCheckError) {
    console.error('[AUTH ERROR] Role check failed:', { adminCheckError, jadminCheckError });
    throw new Error('FORBIDDEN');
  }
  
  if (!hasAdmin && !hasJadmin) {
    console.error('[AUTH ERROR] User does not have admin privileges:', {
      userId: user.id,
      email: user.email,
      hasAdmin,
      hasJadmin
    });
    throw new Error('FORBIDDEN');
  }
  
  console.log(`[AUTH SUCCESS] Admin verified: ${user.email} (${hasAdmin ? 'admin' : 'jadmin'})`);
  
  return { supabase, userId: user.id, userEmail: user.email };
}
