import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createEdgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const logger = createEdgeLogger('verify-password-reset', requestId);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const { token, newPassword } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Reset token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'New password is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Processing password reset verification');

    // Find the token in database
    const { data: tokenData, error: tokenError } = await supabase
      .from('email_magic_tokens')
      .select('*')
      .eq('token', token)
      .eq('token_type', 'password_reset')
      .is('used_at', null)
      .single();

    if (tokenError || !tokenData) {
      logger.warn('Invalid or expired reset token');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired reset link. Please request a new password reset.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      logger.warn('Token has expired', { expiresAt: tokenData.expires_at });
      
      // Mark token as used to prevent retry
      await supabase
        .from('email_magic_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('id', tokenData.id);
        
      return new Response(
        JSON.stringify({ success: false, error: 'This reset link has expired. Please request a new password reset.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user's password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      tokenData.user_id,
      { password: newPassword }
    );

    if (updateError) {
      logger.error('Failed to update password', { error: updateError.message });
      throw new Error('Failed to update password. Please try again.');
    }

    // Mark token as used
    await supabase
      .from('email_magic_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    // Clean up any other unused tokens for this user
    await supabase
      .from('email_magic_tokens')
      .delete()
      .eq('user_id', tokenData.user_id)
      .eq('token_type', 'password_reset')
      .is('used_at', null);

    logger.info('Password reset successful', { userId: tokenData.user_id });

    return new Response(
      JSON.stringify({ success: true, message: 'Password has been updated successfully.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logger.error('Password reset verification error', { error: error.message });
    
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
