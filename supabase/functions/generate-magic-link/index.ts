import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-MAGIC-LINK] ${step}${detailsStr}`);
};

// Helper function to construct URLs safely
const getSiteUrl = () => {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com";
  return frontendUrl.replace(/\/+$/, '');
};

// Generate a secure random token
const generateSecureToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

interface MagicLinkRequest {
  email: string;
  redirectTo?: string;
  expirationHours?: number;
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

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      throw new Error("Insufficient permissions");
    }

    const { 
      email, 
      redirectTo = "/pricing", 
      expirationHours = 48 
    }: MagicLinkRequest = await req.json();

    logStep("Generating magic link", { email, redirectTo, expirationHours });

    // Find the user by email
    const { data: targetUser, error: targetUserError } = await supabaseClient.auth.admin.listUsers();
    if (targetUserError) throw new Error(`Failed to fetch users: ${targetUserError.message}`);

    const foundUser = targetUser.users.find(u => u.email === email);
    if (!foundUser) {
      throw new Error(`User not found with email: ${email}`);
    }

    // Clean up any existing unused tokens for this user
    await supabaseClient
      .from("email_magic_tokens")
      .delete()
      .eq("user_id", foundUser.id)
      .eq("token_type", "pricing_link")
      .is("used_at", null);

    // Generate new secure token
    const magicToken = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);

    // Store the magic token
    const { error: tokenError } = await supabaseClient
      .from("email_magic_tokens")
      .insert({
        user_id: foundUser.id,
        token: magicToken,
        email: email,
        expires_at: expiresAt.toISOString(),
        token_type: "pricing_link",
        metadata: { redirect_to: redirectTo }
      });

    if (tokenError) {
      throw new Error(`Failed to create magic token: ${tokenError.message}`);
    }

    // Construct the magic link
    const magicLink = `${getSiteUrl()}/auth/magic-login?token=${magicToken}&redirect=${encodeURIComponent(redirectTo)}`;

    logStep("Magic link generated successfully", { 
      userId: foundUser.id, 
      tokenLength: magicToken.length,
      expiresAt: expiresAt.toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        magicLink,
        expiresAt: expiresAt.toISOString(),
        message: "Magic link generated successfully"
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