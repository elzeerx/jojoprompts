import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('resend-confirmation-alternative');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface ResendConfirmationRequest {
  userId: string;
  email: string;
}

// Environment validation function
function validateEnvironment() {
  const requiredVars = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "FRONTEND_URL"
  ];
  
  const missing = requiredVars.filter(varName => !Deno.env.get(varName));
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  logger.debug('Environment validation passed', {
    supabaseUrl: !!Deno.env.get("SUPABASE_URL"),
    serviceRoleKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    anonKey: !!Deno.env.get("SUPABASE_ANON_KEY"),
    frontendUrl: !!Deno.env.get("FRONTEND_URL")
  });
}

serve(async (req: Request) => {
  logger.info('Request received', { method: req.method, timestamp: new Date().toISOString() });
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    logger.debug('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables first
    validateEnvironment();
    
    logger.debug('Parsing request body');
    const { userId, email }: ResendConfirmationRequest = await req.json();
    logger.info('Processing resend request', { userId, email });

    // Create admin client
    logger.debug('Creating Supabase admin client');
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the request is from an admin
    logger.debug('Verifying admin authentication');
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logger.error('No authorization header provided');
      throw new Error("Authorization header required");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      logger.error('Authentication failed', { error: authError });
      throw new Error("Invalid authentication");
    }
    logger.debug('User authenticated', { userId: user.id });

    // Check if user is admin via user_roles table
    logger.debug('Checking admin privileges');
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) {
      logger.error('Error checking admin role', { error: roleError });
      throw new Error("Failed to verify admin privileges");
    }

    if (!userRole) {
      logger.error('Access denied - user is not admin');
      throw new Error("Admin access required");
    }
    logger.info('Admin access verified');

    // Get the user to resend confirmation for
    logger.debug('Fetching user data', { userId });
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
      logger.error('User lookup error', { error: userError });
      throw new Error("User not found");
    }
    logger.info('User found', { 
      email: userData.user.email, 
      emailConfirmed: !!userData.user.email_confirmed_at 
    });

    // Check if email is already confirmed
    if (userData.user.email_confirmed_at) {
      logger.warn('Email already confirmed');
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

    // Use Supabase's built-in resend functionality
    logger.info('Using Supabase built-in resend confirmation');
    const { data: resendData, error: resendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com"}/`,
      data: {
        resend: true,
        original_user_id: userId
      }
    });

    if (resendError) {
      logger.warn('Supabase resend error, trying fallback', { error: resendError });
      
      // Fallback: Generate link manually
      logger.info('Trying fallback method with manual link generation');
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: email,
        options: {
          redirectTo: `${Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com"}/`
        }
      });

      if (linkError) {
        logger.error('Manual link generation failed', { error: linkError });
        throw new Error(`Failed to resend confirmation: ${resendError.message}`);
      }

      logger.info('Manual confirmation link generated successfully');
      
      // Log the action for audit
      const { error: auditError } = await supabaseAdmin
        .from("admin_audit_log")
        .insert({
          admin_user_id: user.id,
          action: "resend_confirmation_email_manual",
          target_resource: `user:${userId}`,
          metadata: {
            target_email: email,
            method: "manual_link_generation",
            link_generated: !!linkData?.properties?.action_link
          }
        });

      if (auditError) {
        logger.warn('Failed to log audit entry', { error: auditError });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Confirmation email resent successfully (manual method)",
          method: "manual"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    logger.info('Supabase built-in resend successful', { resendData });

    // Log the action for audit
    const { error: auditError } = await supabaseAdmin
      .from("admin_audit_log")
      .insert({
        admin_user_id: user.id,
        action: "resend_confirmation_email",
        target_resource: `user:${userId}`,
        metadata: {
          target_email: email,
          method: "supabase_builtin",
          resend_data: resendData
        }
      });

    if (auditError) {
      logger.warn('Failed to log audit entry', { error: auditError });
    }

    logger.info('Successfully resent confirmation email', { email, method: 'builtin' });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Confirmation email resent successfully",
        method: "builtin"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    logger.error('Error in resend-confirmation-alternative function', { 
      error: error.message,
      stack: error.stack,
      errorType: error.constructor.name
    });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to resend confirmation email",
        timestamp: new Date().toISOString(),
        debug_info: {
          error_type: error.constructor.name,
          has_stack: !!error.stack
        }
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});