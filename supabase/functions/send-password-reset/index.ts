import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createEdgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const logger = createEdgeLogger('send-password-reset', requestId);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Processing password reset request', { email });

    // Rate limiting: Check recent password reset requests for this email
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentTokens, error: rateError } = await supabase
      .from('email_magic_tokens')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('token_type', 'password_reset')
      .gte('created_at', fiveMinutesAgo)
      .is('used_at', null);

    if (recentTokens && recentTokens.length >= 3) {
      logger.warn('Rate limit exceeded for password reset', { email });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Too many password reset requests. Please wait a few minutes before trying again.' 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by email using admin API
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      logger.error('Error listing users', { error: userError.message });
      throw new Error('Failed to verify user');
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    // Always return success to prevent email enumeration attacks
    // But only send email if user exists
    if (!user) {
      logger.info('No user found for email (returning success to prevent enumeration)', { email });
      return new Response(
        JSON.stringify({ success: true, message: 'If an account exists, a password reset email has been sent.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, username')
      .eq('id', user.id)
      .single();

    const userName = profile?.first_name || profile?.username || 'User';

    // Clean up existing unused tokens for this user
    await supabase
      .from('email_magic_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token_type', 'password_reset')
      .is('used_at', null);

    // Generate new token
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    // Store token in database
    const { error: insertError } = await supabase
      .from('email_magic_tokens')
      .insert({
        user_id: user.id,
        email: email.toLowerCase(),
        token: token,
        token_type: 'password_reset',
        expires_at: expiresAt.toISOString(),
        metadata: { requested_at: new Date().toISOString() }
      });

    if (insertError) {
      logger.error('Failed to store reset token', { error: insertError.message });
      throw new Error('Failed to create password reset token');
    }

    // Build reset URL
    const siteUrl = Deno.env.get('SITE_URL') || 'https://jojoprompts.com';
    const resetUrl = `${siteUrl}/reset-password?token=${token}&type=recovery`;

    // Send email using send-email function
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        to: email,
        subject: 'Reset Your JoJo Prompts Password',
        email_type: 'password_reset',
        user_id: user.id,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset - JoJo Prompts</title>
</head>
<body style="background-color: #ffffff; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.5; margin: 0; padding: 0;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0; padding: 0;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px; background-color: #ffffff;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #c49d68 0%, #7a9e9f 100%); padding: 30px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px; font-family: Arial, sans-serif; color: #ffffff; text-align: center;">
                Password Reset Request
              </h1>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-top: none;">
              <h2 style="color: #333; margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 18px;">
                Hi ${userName},
              </h2>
              
              <p style="color: #666; line-height: 1.6; margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 14px;">
                We received a request to reset your password for your JoJo Prompts account. Click the button below to create a new password:
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 25px auto;">
                <tr>
                  <td style="border-radius: 6px; background-color: #c49d68;">
                    <a href="${resetUrl}" target="_blank" style="background-color: #c49d68; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block; font-family: Arial, sans-serif;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #666; font-size: 13px; line-height: 1.5; margin: 20px 0 0 0; font-family: Arial, sans-serif;">
                <strong>This link will expire in 1 hour.</strong>
              </p>
              
              <p style="color: #999; font-size: 12px; line-height: 1.5; margin: 15px 0 0 0; font-family: Arial, sans-serif;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              
              <p style="color: #999; font-size: 12px; line-height: 1.5; margin: 15px 0 0 0; font-family: Arial, sans-serif;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #c49d68; word-break: break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px; background-color: #262626; border-radius: 0 0 8px 8px;">
              <p style="color: #999; margin: 0; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                Questions? Contact us at <a href="mailto:info@jojoprompts.com" style="color: #c49d68;">info@jojoprompts.com</a>
              </p>
              <p style="color: #666; margin: 10px 0 0 0; font-family: Arial, sans-serif; font-size: 11px; text-align: center;">
                JoJo Prompts, Part of Recipe Group<br>
                Abdullah Al Mubarak St, Humaidhiyah Tower<br>
                Murqab, Kuwait City 15001
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
        text: `Hi ${userName},

We received a request to reset your password for your JoJo Prompts account.

Click the link below to create a new password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

Questions? Contact us at info@jojoprompts.com

JoJo Prompts, Part of Recipe Group
Abdullah Al Mubarak St, Humaidhiyah Tower
Murqab, Kuwait City 15001`
      })
    });

    const emailResult = await emailResponse.json();

    if (!emailResult.success) {
      logger.error('Failed to send password reset email', { error: emailResult.error });
      throw new Error('Failed to send password reset email');
    }

    logger.info('Password reset email sent successfully', { email, userId: user.id });

    return new Response(
      JSON.stringify({ success: true, message: 'If an account exists, a password reset email has been sent.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logger.error('Password reset error', { error: error.message });
    
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
