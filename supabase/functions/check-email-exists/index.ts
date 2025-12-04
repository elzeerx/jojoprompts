import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    if (!email || typeof email !== 'string') {
      console.log('[check-email-exists] Invalid email provided');
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    console.log('[check-email-exists] Checking email existence');

    // Create admin client to check auth.users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if user exists in profiles table (safer than auth.users)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', trimmedEmail)
      .maybeSingle();

    if (profileError) {
      console.error('[check-email-exists] Profile query error:', profileError);
      // Don't expose the error, just return exists: false
      return new Response(
        JSON.stringify({ exists: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const exists = !!profile;
    console.log('[check-email-exists] Email check result:', { exists });

    return new Response(
      JSON.stringify({ exists }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[check-email-exists] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
