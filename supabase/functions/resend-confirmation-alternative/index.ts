import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("resend-confirmation-alternative function initialized");

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
  
  console.log("Environment validation passed:", {
    supabaseUrl: !!Deno.env.get("SUPABASE_URL"),
    serviceRoleKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    anonKey: !!Deno.env.get("SUPABASE_ANON_KEY"),
    frontendUrl: !!Deno.env.get("FRONTEND_URL")
  });
}

serve(async (req: Request) => {
  console.log(`${new Date().toISOString()} - ${req.method} request received`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables first
    validateEnvironment();
    
    console.log("Parsing request body...");
    const { userId, email }: ResendConfirmationRequest = await req.json();
    console.log(`Processing resend request for user: ${userId} (${email})`);

    // Create admin client
    console.log("Creating Supabase admin client...");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the request is from an admin
    console.log("Verifying admin authentication...");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error("Authorization header required");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("Authentication failed:", authError);
      throw new Error("Invalid authentication");
    }
    console.log(`Authenticated user: ${user.id}`);

    // Check if user is admin
    console.log("Checking admin privileges...");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Error checking admin role:", profileError);
      throw new Error("Failed to verify admin privileges");
    }

    if (!profile || profile.role !== "admin") {
      console.error(`Access denied. User role: ${profile?.role || 'unknown'}`);
      throw new Error("Admin access required");
    }
    console.log("Admin access verified");

    // Get the user to resend confirmation for
    console.log(`Fetching user data for: ${userId}`);
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
      console.error("User lookup error:", userError);
      throw new Error("User not found");
    }
    console.log(`User found: ${userData.user.email}, confirmed: ${!!userData.user.email_confirmed_at}`);

    // Check if email is already confirmed
    if (userData.user.email_confirmed_at) {
      console.log("Email already confirmed");
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
    console.log("Using Supabase built-in resend confirmation...");
    const { data: resendData, error: resendError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com"}/`,
      data: {
        resend: true,
        original_user_id: userId
      }
    });

    if (resendError) {
      console.error("Supabase resend error:", resendError);
      
      // Fallback: Generate link manually
      console.log("Trying fallback method with manual link generation...");
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: email,
        options: {
          redirectTo: `${Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com"}/`
        }
      });

      if (linkError) {
        console.error("Manual link generation failed:", linkError);
        throw new Error(`Failed to resend confirmation: ${resendError.message}`);
      }

      console.log("Manual confirmation link generated successfully");
      
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
        console.warn("Failed to log audit entry:", auditError);
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

    console.log("Supabase built-in resend successful:", resendData);

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
      console.warn("Failed to log audit entry:", auditError);
    }

    console.log(`Successfully resent confirmation email to ${email} using Supabase built-in method`);

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
    console.error("Error in resend-confirmation-alternative function:", error);
    console.error("Error stack:", error.stack);
    
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