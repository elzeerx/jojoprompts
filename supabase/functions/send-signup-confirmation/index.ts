import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('send-signup-confirmation');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface SignupConfirmationRequest {
  email: string;
  firstName: string;
  lastName: string;
  userId: string;
  redirectUrl: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, lastName, userId, redirectUrl }: SignupConfirmationRequest = await req.json();

    logger.info('Sending signup confirmation email', { email, userId });

    // Create admin client to generate confirmation link
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Since email confirmation is disabled in Supabase Auth settings, 
    // we'll use 'invite' type which works even when confirmation is disabled
    
    // Add signup confirmation flag to redirect URL
    const baseRedirectUrl = redirectUrl || `${Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com"}/prompts`;
    const url = new URL(baseRedirectUrl);
    url.searchParams.set('from_signup', 'true');
    
    logger.debug('Magic link redirect URL', { 
      original: baseRedirectUrl, 
      final: url.toString(),
      hasPlanId: url.searchParams.has('plan_id'),
      planId: url.searchParams.get('plan_id')
    });
    
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email,
      options: {
        redirectTo: url.toString()
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      logger.error('Error generating confirmation link', { error: linkError?.message, email });
      throw new Error(`Failed to generate confirmation link: ${linkError?.message || 'No action link returned'}`);
    }

    const confirmationLink = linkData.properties.action_link;
    logger.info('Generated confirmation link', { email });

    const userName = `${firstName} ${lastName}`.trim() || email.split('@')[0];

    // Send email via our optimized send-email function
    const emailPayload = {
      to: email,
      template: "emailConfirmation",
      email_type: "email_confirmation",
      user_id: userId,
      data: {
        name: userName,
        email: email,
        confirmationLink: confirmationLink
      }
    };

    logger.debug('Sending email with payload', { 
      to: emailPayload.to, 
      template: emailPayload.template, 
      email_type: emailPayload.email_type,
      hasConfirmationLink: !!emailPayload.data.confirmationLink
    });

    const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke('send-email', {
      body: emailPayload
    });

    logger.debug('Email function response', { emailData, hasError: !!emailError });

    if (emailError) {
      logger.error('Error sending confirmation email', { error: emailError.message, email });
      throw new Error(`Failed to send confirmation email: ${emailError.message || 'Unknown error from send-email function'}`);
    }

    logger.info('Confirmation email sent successfully', { email, emailData });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Confirmation email sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    logger.error('Error in send-signup-confirmation', { error: error.message });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to send confirmation email" 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});