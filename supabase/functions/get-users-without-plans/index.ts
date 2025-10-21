import { serve, corsHeaders, handleCors, createErrorResponse, createSuccessResponse } from "../_shared/standardImports.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-USERS-WITHOUT-PLANS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors();
  }

  try {
    logStep("Function started");

    // Admin authentication using shared module
    const { supabase, userId } = await verifyAdmin(req);
    logStep("Admin authenticated", { adminId: userId });

    // First get users with active subscriptions
    const { data: activeSubscriptions, error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("status", "active");

    if (subscriptionError) {
      throw new Error(`Error fetching active subscriptions: ${subscriptionError.message}`);
    }

    const activeUserIds = activeSubscriptions?.map(sub => sub.user_id) || [];
    
    logStep("Active subscription users found", { count: activeUserIds.length });

    // Get all users without active subscriptions
    let query = supabase
      .from("profiles")
      .select(`
        id,
        first_name,
        last_name,
        username,
        role,
        created_at
      `)
      .eq("role", "user");

    // If there are active users, exclude them
    if (activeUserIds.length > 0) {
      query = query.not("id", "in", `(${activeUserIds.join(',')})`);
    }

    const { data: usersWithoutPlans, error: usersError } = await query;

    if (usersError) {
      throw new Error(`Database error: ${usersError.message}`);
    }

    // Get email addresses for these users from auth.users
    const userIds = usersWithoutPlans?.map(u => u.id) || [];
    const usersWithEmails = [];

    for (const userProfile of usersWithoutPlans || []) {
      // Get email from auth metadata or use a placeholder
      const { data: authUser } = await supabase.auth.admin.getUserById(userProfile.id);
      
      usersWithEmails.push({
        ...userProfile,
        email: authUser.user?.email || null
      });
    }

    logStep("Users without plans fetched", { count: usersWithEmails.length });

    return createSuccessResponse({
      success: true,
      users: usersWithEmails,
      total: usersWithEmails.length
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return createErrorResponse(errorMessage, 500);
  }
});