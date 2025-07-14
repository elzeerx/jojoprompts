import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Generate confirmation link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: email,
      options: {
        redirectTo: `${Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com"}/`
      }
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Error generating confirmation link:", linkError);
      throw new Error(`Failed to generate confirmation link: ${linkError?.message || 'No action link returned'}`);
    }

    const confirmationLink = linkData.properties.action_link;
    console.log(`Generated confirmation link for ${email}`);

    // Get user profile to get name
    const { data: profile, error: profileQueryError } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileQueryError) {
      console.warn("Error fetching user profile:", profileQueryError);
    }

    const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : email.split('@')[0];

    // Send email via our send-email function with Resend
    console.log(`Calling send-email function for ${email} (domain: ${email.split('@')[1]})`);
    
    const emailPayload = {
      to: email,
      subject: "Confirm Your Email - JojoPrompts",
      template: "emailConfirmation",
      email_type: "email_confirmation",
      user_id: userId,
      data: {
        name: userName,
        email: email,
        confirmationLink: confirmationLink
      }
    };

    console.log('Email payload:', { 
      to: emailPayload.to, 
      template: emailPayload.template, 
      email_type: emailPayload.email_type,
      userName: userName 
    });

    const { data: emailData, error: emailError } = await supabaseAdmin.functions.invoke('send-email', {
      body: emailPayload
    });

    if (emailError) {
      console.error("Error sending confirmation email via Resend:", emailError);
      console.error("Full error details:", emailError);
      throw new Error(`Failed to send confirmation email: ${emailError.message || 'Unknown error from send-email function'}`);
    }

    console.log("Email function response:", emailData);
    console.log(`Successfully sent confirmation email via Resend to ${email}`);

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