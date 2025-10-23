import { serve, corsHeaders, handleCors, createErrorResponse, createSuccessResponse } from "../_shared/standardImports.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";
import { createEdgeLogger } from "../_shared/logger.ts";

const logger = createEdgeLogger('GET_USERS_WITHOUT_PLANS');

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors();
  }

  try {
    logger.info('Function started');

    // Admin authentication using shared module
    const { supabase, userId } = await verifyAdmin(req);
    logger.debug('Admin authenticated', { adminId: userId });

    // First get users with active subscriptions
    const { data: activeSubscriptions, error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("status", "active");

    if (subscriptionError) {
      throw new Error(`Error fetching active subscriptions: ${subscriptionError.message}`);
    }

    const activeUserIds = activeSubscriptions?.map(sub => sub.user_id) || [];
    
    logger.debug('Active subscription users found', { count: activeUserIds.length });

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

    logger.info('Users without plans fetched', { count: usersWithEmails.length });

    return createSuccessResponse({
      success: true,
      users: usersWithEmails,
      total: usersWithEmails.length
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Function error', { error: errorMessage });
    return createErrorResponse(errorMessage, 500);
  }
});