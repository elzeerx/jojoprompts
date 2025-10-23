
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createEdgeLogger } from "../_shared/logger.ts";

const logger = createEdgeLogger('DELETE_MY_ACCOUNT');

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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    
    // Create user client for authentication and RPC calls
    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // Create admin client for auth user deletion
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { confirmationEmail } = await req.json();

    // Verify the confirmation email matches the user's email
    if (confirmationEmail !== user.email) {
      throw new Error('Confirmation email does not match your account email');
    }

    logger.info('Starting account deletion', { userId: user.id });

    // Call the database function to delete the account using user client
    const { data, error } = await userClient.rpc('delete_user_account', {
      _user_id: user.id
    });

    if (error) {
      throw error;
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to delete account');
    }

    logger.info('Account deletion completed', { userId: user.id, subscription_cancelled: data.subscription_cancelled });

    // Now delete the auth user using admin client
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);
    
    if (deleteAuthError) {
      logger.error('Error deleting auth user', { error: deleteAuthError.message });
      // Don't throw here as the main data cleanup was successful
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Account deleted successfully',
      subscription_cancelled: data.subscription_cancelled
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    logger.error('Account deletion failed', { error: error.message });
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
