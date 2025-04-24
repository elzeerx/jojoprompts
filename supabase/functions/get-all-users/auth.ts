
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

interface AuthContext {
  supabase: ReturnType<typeof createClient>;
  userId: string;
}

export async function verifyAdmin(req: Request): Promise<AuthContext> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Unauthorized - Missing authorization header');
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user) {
    throw new Error('Unauthorized - Invalid token');
  }

  console.log(`User ${user.id} is attempting to access admin functionality`);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Error fetching user profile:', profileError);
    throw new Error(`Error fetching user profile: ${profileError.message}`);
  }

  if (!profile || profile.role !== 'admin') {
    console.error(`User ${user.id} is not an admin. Role: ${profile?.role || 'unknown'}`);
    throw new Error('Forbidden - Admin role required');
  }

  return { supabase, userId: user.id };
}
