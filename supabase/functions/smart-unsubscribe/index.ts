import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SMART-UNSUBSCRIBE] ${step}${detailsStr}`);
};

// Helper function to construct URLs safely
const getSiteUrl = () => {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com";
  return frontendUrl.replace(/\/+$/, '');
};

// Generate a secure random token for unsubscribe
const generateUnsubscribeToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

interface UnsubscribeRequest {
  email: string;
  unsubscribeType?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const email = url.searchParams.get('email');

    if (token) {
      // Handle unsubscribe with token
      logStep("Processing unsubscribe with token", { tokenLength: token.length });

      // Find and validate the magic token
      const { data: magicTokenData, error: tokenError } = await supabaseClient
        .from("email_magic_tokens")
        .select("*")
        .eq("token", token)
        .eq("token_type", "unsubscribe_link")
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (tokenError || !magicTokenData) {
        logStep("Invalid or expired unsubscribe token", { error: tokenError?.message });
        return new Response(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Invalid or Expired Link</h2>
              <p>This unsubscribe link is invalid or has expired.</p>
              <p><a href="${getSiteUrl()}">Return to JojoPrompts</a></p>
            </body>
          </html>
        `, {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
          status: 400,
        });
      }

      // Mark the token as used
      await supabaseClient
        .from("email_magic_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", magicTokenData.id);

      // Add to unsubscribed emails
      const { error: unsubscribeError } = await supabaseClient
        .from("unsubscribed_emails")
        .upsert({
          email: magicTokenData.email,
          unsubscribe_type: 'marketing',
          unsubscribed_at: new Date().toISOString()
        });

      if (unsubscribeError) {
        logStep("Failed to record unsubscribe", { error: unsubscribeError.message });
      }

      logStep("User successfully unsubscribed", { email: magicTokenData.email });

      return new Response(`
        <html>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <div style="max-width: 500px; margin: 0 auto;">
              <h1 style="color: #c49d68;">Successfully Unsubscribed</h1>
              <p>You have been unsubscribed from marketing emails.</p>
              <p>We're sorry to see you go! If you change your mind, you can always resubscribe by visiting your account settings.</p>
              <div style="margin: 30px 0;">
                <a href="${getSiteUrl()}" style="display: inline-block; padding: 12px 24px; background: #c49d68; color: white; text-decoration: none; border-radius: 6px;">Return to JojoPrompts</a>
              </div>
            </div>
          </body>
        </html>
      `, {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
        status: 200,
      });

    } else if (email) {
      // Generate unsubscribe token for the email
      const unsubscribeToken = generateUnsubscribeToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72); // 72 hour expiration

      // Find the user by email
      const { data: targetUser, error: targetUserError } = await supabaseClient.auth.admin.listUsers();
      if (targetUserError) throw new Error(`Failed to fetch users: ${targetUserError.message}`);

      const foundUser = targetUser.users.find(u => u.email === email);
      if (!foundUser) {
        throw new Error(`User not found with email: ${email}`);
      }

      // Store the unsubscribe token
      const { error: tokenError } = await supabaseClient
        .from("email_magic_tokens")
        .insert({
          user_id: foundUser.id,
          token: unsubscribeToken,
          email: email,
          expires_at: expiresAt.toISOString(),
          token_type: "unsubscribe_link",
          metadata: { unsubscribe_type: "marketing" }
        });

      if (tokenError) {
        throw new Error(`Failed to create unsubscribe token: ${tokenError.message}`);
      }

      // Return the unsubscribe link
      const unsubscribeLink = `${getSiteUrl()}/unsubscribe?token=${unsubscribeToken}`;

      return new Response(
        JSON.stringify({ 
          success: true, 
          unsubscribeLink,
          expiresAt: expiresAt.toISOString(),
          message: "Unsubscribe link generated successfully"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );

    } else {
      throw new Error("Either token or email parameter is required");
    }

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
};

serve(handler);