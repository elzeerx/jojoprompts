import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("resend-confirmation-email function initialized");

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

    console.log(`Resending confirmation email for: ${email}`);

    // Create admin client to resend confirmation
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Look up user by email to get their ID and check confirmation status
    const { data: authUserData, error: userLookupError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userLookupError) {
      console.error("Error looking up users:", userLookupError);
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

    const userName = firstName || email.split('@')[0];

    // Send email via our send-email function with Resend
    console.log(`Calling send-email function for ${email} (domain: ${email.split('@')[1]})`);
    
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