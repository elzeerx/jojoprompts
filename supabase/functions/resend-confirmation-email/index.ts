import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendConfirmationRequest {
  userId: string;
  email: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email }: ResendConfirmationRequest = await req.json();

    console.log(`Resending confirmation email for user: ${userId} (${email})`);

    // Create admin client to resend confirmation
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the request is from an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Invalid authentication");
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      throw new Error("Admin access required");
    }

    // Get the user to resend confirmation for
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
      throw new Error("User not found");
    }

    // Check if email is already confirmed
    if (userData.user.email_confirmed_at) {
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

    // Resend confirmation email
    const { error: resendError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: `${Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com"}/`
      }
    });

    if (resendError) {
      console.error("Error resending confirmation:", resendError);
      throw new Error(`Failed to resend confirmation: ${resendError.message}`);
    }

    // Log the email sending attempt
    await supabaseAdmin
      .from("email_logs")
      .insert({
        email_address: email,
        email_type: "email_confirmation_resend",
        success: true,
        user_id: userId
      });

    console.log(`Successfully resent confirmation email to ${email}`);

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
    console.error("Error in resend-confirmation-email function:", error);
    
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