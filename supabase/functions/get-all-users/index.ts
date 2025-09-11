import { serve, corsHeaders, createSupabaseClient, handleCors } from "../_shared/standardImports.ts";
import { verifyAdmin, validateAdminRequest, hasPermission, logSecurityEvent } from "../_shared/adminAuth.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    // Enhanced request validation
    const validation = validateAdminRequest(req);
    if (!validation.isValid) {
      console.error('Request validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Enhanced admin authentication with comprehensive security
    const authContext = await verifyAdmin(req);
    const { supabase, userId, userRole, permissions } = authContext;

    // Log successful admin access
    await logSecurityEvent(supabase, {
      user_id: userId,
      action: 'admin_function_accessed',
      details: { 
        function: 'get-all-users',
        method: req.method,
        role: userRole
      },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent')?.substring(0, 200)
    });

    // Handle different HTTP methods with enhanced security
    switch (req.method) {
      case 'GET':
        // Verify read permissions
        if (!hasPermission(permissions, 'user:read')) {
          await logSecurityEvent(supabase, {
            user_id: userId,
            action: 'permission_denied',
            details: { required_permission: 'user:read', function: 'get-all-users' }
          });
          
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions for user read operations' }), 
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        return await handleGetUsers(supabase, userId, req);

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }), 
          { 
            status: 405, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

  } catch (error: any) {
    console.error('Critical error in get-all-users function:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString()
    });

    // Try to log the error if we have a supabase client
    try {      
      const supabase = createSupabaseClient();
      await logSecurityEvent(supabase, {
        action: 'function_error',
        details: { 
          function: 'get-all-users',
          error: error.message,
          method: req.method
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      });
    } catch (logError) {
      console.warn('Failed to log error event:', logError);
    }

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred' 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Simplified handleGetUsers function directly in this file
async function handleGetUsers(supabase: any, adminId: string, req: Request) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const search = url.searchParams.get('search') || '';
    
    console.log(`[${requestId}] Starting getUsersHandler - page: ${page}, limit: ${limit}, search: "${search}"`);
    
    // Enhanced validation
    if (page < 1 || limit < 1) {
      console.warn(`[${requestId}] Invalid pagination parameters: page=${page}, limit=${limit}`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid pagination parameters',
          details: { page, limit }
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get all users from auth
    console.log(`[${requestId}] Fetching all users from auth`);
    let allUsers: any[] = [];
    let page_num = 1;
    let hasMore = true;
    const perPage = 1000;
    
    while (hasMore) {
      const { data: batchUsers, error: batchError } = await supabase.auth.admin.listUsers({
        perPage,
        page: page_num
      });
      
      if (batchError) {
        console.error(`[${requestId}] Error fetching user batch ${page_num}:`, batchError);
        throw new Error(`Failed to fetch users: ${batchError.message}`);
      }
      
      const batchUserList = batchUsers?.users || [];
      allUsers.push(...batchUserList);
      
      hasMore = batchUserList.length === perPage;
      page_num++;
      
      // Safety break to prevent infinite loops
      if (page_num > 50) {
        console.warn(`[${requestId}] Breaking pagination loop at page ${page_num} - potential infinite loop`);
        break;
      }
    }
    
    // Filter out users without profiles - only show users with corresponding profiles
    if (allUsers.length > 0) {
      const allUserIds = allUsers.map(user => user.id);
      const { data: existingProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .in('id', allUserIds);
      
      if (profileError) {
        console.error(`[${requestId}] Error fetching profiles for filtering:`, profileError);
        // If we can't fetch profiles, continue with all users to avoid breaking functionality
      } else {
        const existingProfileIds = new Set(existingProfiles?.map(p => p.id) || []);
        const originalCount = allUsers.length;
        allUsers = allUsers.filter(user => existingProfileIds.has(user.id));
        console.log(`[${requestId}] Filtered users: ${originalCount} -> ${allUsers.length} (removed ${originalCount - allUsers.length} users without profiles)`);
      }
    }
    
    const totalUsers = allUsers.length;
    
    // Apply search filter if provided
    let filteredUsers = allUsers;
    if (search) {
      filteredUsers = allUsers.filter((user: any) => {
        const email = user.email?.toLowerCase() || '';
        const searchLower = search.toLowerCase();
        return email.includes(searchLower);
      });
    }
    
    const totalFilteredUsers = filteredUsers.length;
    
    // Validation - ensure page doesn't exceed available pages
    const totalPages = Math.ceil(totalFilteredUsers / limit);
    if (page > totalPages && totalFilteredUsers > 0) {
      console.warn(`[${requestId}] Page ${page} exceeds available pages ${totalPages}, redirecting to last page`);
      const correctedPage = Math.max(1, totalPages);
      return new Response(
        JSON.stringify({ 
          error: 'Page exceeds available data',
          redirect: { page: correctedPage, totalPages },
          total: totalFilteredUsers,
          totalUsers
        }), 
        { 
          status: 416, // Range Not Satisfiable
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Apply pagination to filtered results
    const startIndex = (page - 1) * limit;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + limit);
    
    // Get user IDs from paginated results for profile enrichment
    const userIds = paginatedUsers.map((user: any) => user.id);
    
    // Enhanced profile fetching with error recovery
    let profiles = [];
    let subscriptions = [];
    if (userIds.length > 0) {
      try {
        // Fetch profiles
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, username, role, created_at')
          .in('id', userIds);
        
        if (profileError) {
          console.error(`[${requestId}] Database error when fetching profiles:`, profileError);
          profiles = [];
        } else {
          profiles = profilesData || [];
        }

        // Fetch active subscriptions with plan details
        const { data: subscriptionsData, error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .select(`
            user_id, 
            status,
            created_at,
            end_date,
            plan_id:subscription_plans(id, name, price_usd, is_lifetime)
          `)
          .in('user_id', userIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (subscriptionError) {
          console.error(`[${requestId}] Database error when fetching subscriptions:`, subscriptionError);
          subscriptions = [];
        } else {
          subscriptions = subscriptionsData || [];
        }
      } catch (fetchError) {
        console.error(`[${requestId}] Exception during profile/subscription fetch:`, fetchError);
        profiles = [];
        subscriptions = [];
      }
    }
    
    // Merge profile data and subscription data with auth data
    const enrichedUsers = paginatedUsers.map((authUser: any) => {
      const profile = profiles.find((p: any) => p.id === authUser.id);
      // Find the most recent active subscription for this user
      const userSubscriptions = subscriptions.filter((sub: any) => sub.user_id === authUser.id);
      const latestSubscription = userSubscriptions.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      return {
        id: authUser.id,
        email: authUser.email || 'unknown',
        emailConfirmed: !!authUser.email_confirmed_at,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        role: profile?.role || 'user',
        username: profile?.username || '',
        subscription: latestSubscription ? {
          plan_name: latestSubscription.plan_id?.name || 'Unknown',
          status: latestSubscription.status,
          end_date: latestSubscription.end_date,
          is_lifetime: latestSubscription.plan_id?.is_lifetime || false,
          price_usd: latestSubscription.plan_id?.price_usd || 0
        } : null
      };
    });
    
    // Calculate final pagination info
    const finalTotalPages = Math.ceil(totalFilteredUsers / limit);
    
    // Enhanced response with performance metadata
    const responseData = {
      users: enrichedUsers,
      total: totalFilteredUsers,
      totalUsers: totalUsers,
      page,
      limit,
      totalPages: finalTotalPages,
      performance: {
        requestId,
        totalDuration: Date.now() - startTime,
        searchActive: !!search
      }
    };
    
    console.log(`[${requestId}] Request completed successfully - returned ${enrichedUsers.length} users`);
    
    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    const errorDuration = Date.now() - startTime;
    console.error(`[${requestId}] Error in handleGetUsers (${errorDuration}ms):`, error);
    
    // Enhanced error response with more context
    const errorResponse = {
      error: 'Failed to fetch users',
      message: error.message || 'Unknown error occurred',
      requestId,
      timestamp: new Date().toISOString(),
      duration: errorDuration
    };
    
    return new Response(
      JSON.stringify(errorResponse), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}