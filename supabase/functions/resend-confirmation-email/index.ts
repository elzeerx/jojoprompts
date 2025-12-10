import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('resend-confirmation-email');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface ResendConfirmationRequest {
  email: string;
  firstName: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName }: ResendConfirmationRequest = await req.json();

    logger.info('Resending confirmation email', { email });

    // Create admin client to resend confirmation
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Look up user by email to get their ID and check confirmation status
    const { data: authUserData, error: userLookupError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userLookupError) {
      logger.error('Error looking up users', { error: userLookupError.message });
      throw new Error("Failed to lookup user");
    }

    const targetUser = authUserData.users.find(u => u.email === email);
    if (!targetUser) {
      throw new Error("User not found");
    }

    // Check if email is already confirmed
    if (targetUser.email_confirmed_at) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email is already confirmed" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Since email confirmation is disabled in Supabase Auth settings, 
    // we'll use 'invite' type which works even when confirmation is disabled
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email,
      options: {
        redirectTo: `${Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com"}/`
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      logger.error('Error generating confirmation link', { error: linkError?.message, email });
      throw new Error(`Failed to generate confirmation link: ${linkError?.message || 'No action link returned'}`);
    }

    const confirmationLink = linkData.properties.action_link;
    logger.info('Generated confirmation link', { email });

    const userName = firstName || email.split('@')[0];

    // Send email via our send-email function with Resend
    logger.info('Calling send-email function', { email, domain: email.split('@')[1] });
    
    const emailPayload = {
      to: email,
      subject: "Confirm Your Email - JojoPrompts",
      template: "emailConfirmation",
      email_type: "email_confirmation",
      user_id: targetUser.id,
      data: {
        name: userName,
        email: email,
        confirmationLink: confirmationLink
      }
    };

    logger.debug('Email payload prepared', { 
      to: emailPayload.to, 
      template: emailPayload.template, 
      email_type: emailPayload.email_type 
    });

    const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke('send-email', {
      body: emailPayload
    });

    if (emailError) {
      logger.error('Error sending confirmation email', { 
        error: emailError.message, 
        email,
        details: emailError 
      });
      throw new Error(`Failed to send confirmation email: ${emailError.message || 'Unknown error from send-email function'}`);
    }

    logger.info('Confirmation email sent successfully', { email, emailData });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Confirmation email resent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    logger.error('Error in resend-confirmation-email', { error: error.message });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to resend confirmation email" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});