
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { confirmationEmail } = await req.json();

    // Verify the confirmation email matches the user's email
    if (confirmationEmail !== user.email) {
      throw new Error('Confirmation email does not match your account email');
    }

    console.log(`Starting account deletion for user: ${user.id}`);

    // Call the database function to delete the account
    const { data, error } = await supabase.rpc('delete_user_account', {
      _user_id: user.id
    });

    if (error) {
      throw error;
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to delete account');
    }

    console.log(`Account deletion completed for user: ${user.id}`, data);

    // Now delete the auth user (this will cascade to our cleaned up profile)
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(user.id);
    
    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // Don't throw here as the main data cleanup was successful
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Account deleted successfully',
      subscription_cancelled: data.subscription_cancelled
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
