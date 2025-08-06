import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-USERS-WITHOUT-PLANS] ${step}${detailsStr}`);
};

serve(async (req) => {
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

    logStep("Admin authenticated", { adminId: user.id });

    // Get all users without active subscriptions
    const { data: usersWithoutPlans, error: usersError } = await supabaseClient
      .from("profiles")
      .select(`
        id,
        first_name,
        last_name,
        username,
        role,
        created_at
      `)
      .eq("role", "user")
      .not("id", "in", `(
        SELECT DISTINCT user_id 
        FROM user_subscriptions 
        WHERE status = 'active'
      )`);

    if (usersError) {
      throw new Error(`Database error: ${usersError.message}`);
    }

    // Get email addresses for these users from auth.users
    const userIds = usersWithoutPlans?.map(u => u.id) || [];
    const usersWithEmails = [];

    for (const userProfile of usersWithoutPlans || []) {
      // Get email from auth metadata or use a placeholder
      const { data: authUser } = await supabaseClient.auth.admin.getUserById(userProfile.id);
      
      usersWithEmails.push({
        ...userProfile,
        email: authUser.user?.email || null
      });
    }

    logStep("Users without plans fetched", { count: usersWithEmails.length });

    return new Response(
      JSON.stringify({
        success: true,
        users: usersWithEmails,
        total: usersWithEmails.length
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
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
});