import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MAGIC-LOGIN] ${step}${detailsStr}`);
};

// Helper function to construct URLs safely
const getSiteUrl = () => {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com";
  return frontendUrl.replace(/\/+$/, '');
};

interface MagicLoginRequest {
  token: string;
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

    const { token }: MagicLoginRequest = await req.json();

    if (!token) {
      throw new Error("Magic token is required");
    }

    logStep("Validating magic token", { tokenLength: token.length });

    // Find and validate the magic token
    const { data: magicTokenData, error: tokenError } = await supabaseClient
      .from("email_magic_tokens")
      .select("*")
      .eq("token", token)
      .eq("token_type", "pricing_link")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (tokenError || !magicTokenData) {
      logStep("Invalid or expired token", { error: tokenError?.message });
      throw new Error("Invalid or expired magic link");
    }

    logStep("Magic token found", { 
      userId: magicTokenData.user_id, 
      email: magicTokenData.email,
      createdAt: magicTokenData.created_at 
    });

    // Get the user from auth
    const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(magicTokenData.user_id);
    if (userError || !userData.user) {
      throw new Error("User not found");
    }

    // Mark the token as used
    await supabaseClient
      .from("email_magic_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", magicTokenData.id);

    // Generate a temporary session for the user
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email!,
      options: {
        redirectTo: `${getSiteUrl()}${magicTokenData.metadata?.redirect_to || '/pricing'}`
      }
    });

    if (sessionError) {
      throw new Error(`Failed to generate session: ${sessionError.message}`);
    }

    logStep("Session generated successfully", { 
      userId: userData.user.id,
      email: userData.user.email,
      redirectTo: magicTokenData.metadata?.redirect_to
    });

    // Log the successful login
    await supabaseClient.from("security_logs").insert({
      user_id: userData.user.id,
      action: "magic_link_login",
      details: {
        token_type: "pricing_link",
        redirect_to: magicTokenData.metadata?.redirect_to,
        source: "email_marketing"
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Magic login successful",
        authUrl: sessionData.properties.action_link,
        redirectTo: magicTokenData.metadata?.redirect_to || '/pricing'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

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