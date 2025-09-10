
import { corsHeaders } from "../cors.ts";
import { logAdminAction } from "../../shared/securityLogger.ts";

// Cache for user counts to reduce expensive queries
let userCountCache: { 
  count: number; 
  timestamp: number; 
  search?: string; 
  filteredCount?: number 
} | null = null;

const CACHE_DURATION = 30000; // 30 seconds cache

// Performance monitoring utilities
function logPerformanceMetrics(operation: string, startTime: number, metadata?: any) {
  const duration = Date.now() - startTime;
  console.log(`[PERF] ${operation}: ${duration}ms`, metadata ? JSON.stringify(metadata) : '');
}

export async function handleGetUsers(supabase: any, adminId: string, req: Request) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const search = url.searchParams.get('search') || '';
    
    console.log(`[${requestId}] Starting getUsersHandler - page: ${page}, limit: ${limit}, search: "${search}"`);
    
    // Phase 4: Enhanced validation
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

    // Phase 3: Enhanced logging with performance tracking
    const logStartTime = Date.now();
    await logAdminAction(supabase, adminId, 'list_users', 'users', {
      request_id: requestId,
      page,
      limit,
      search_query: search ? 'provided' : 'none',
      user_agent: req.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    });
    logPerformanceMetrics('Admin action logging', logStartTime);

    // Phase 2: Fixed search implementation - get all users first, then filter and paginate
    let allUsers: any[] = [];
    let totalUsers = 0;
    let totalFilteredUsers = 0;
    
    // Phase 5: Check cache first for performance optimization
    const cacheKey = search || 'all';
    const now = Date.now();
    const canUseCache = userCountCache && 
      (now - userCountCache.timestamp) < CACHE_DURATION &&
      (search === (userCountCache.search || ''));
    
    if (canUseCache && userCountCache) {
      console.log(`[${requestId}] Using cached user count - total: ${userCountCache.count}, filtered: ${userCountCache.filteredCount}`);
      totalUsers = userCountCache.count;
      totalFilteredUsers = userCountCache.filteredCount || userCountCache.count;
    } else {
      // Phase 2: Get all users for proper search and pagination
      console.log(`[${requestId}] Fetching all users for count and filtering`);
      const countStartTime = Date.now();
      
      // Use multiple requests with pagination to handle large user bases
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
      const profileFilterStartTime = Date.now();
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
      logPerformanceMetrics('Profile filtering', profileFilterStartTime, { 
        originalUsers: allUsers.length + (allUsers.length > 0 ? 1 : 0), 
        filteredUsers: allUsers.length 
      });
      
      totalUsers = allUsers.length;
      logPerformanceMetrics('Fetch all users', countStartTime, { totalUsers, pagesProcessed: page_num - 1 });
      
      // Apply search filter if provided
      let filteredUsers = allUsers;
      if (search) {
        const searchStartTime = Date.now();
        filteredUsers = allUsers.filter((user: any) => {
          const email = user.email?.toLowerCase() || '';
          const searchLower = search.toLowerCase();
          return email.includes(searchLower);
        });
        totalFilteredUsers = filteredUsers.length;
        logPerformanceMetrics('Search filtering', searchStartTime, { 
          searchTerm: search, 
          totalUsers, 
          filteredUsers: totalFilteredUsers 
        });
      } else {
        totalFilteredUsers = totalUsers;
      }
      
      // Phase 5: Cache the results
      userCountCache = {
        count: totalUsers,
        filteredCount: totalFilteredUsers,
        timestamp: now,
        search: search || undefined
      };
      
      console.log(`[${requestId}] Updated cache - total: ${totalUsers}, filtered: ${totalFilteredUsers}`);
    }
    
    // Phase 4: Validation - ensure page doesn't exceed available pages
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
    
    // Now get the actual paginated users for this page
    const paginationStartTime = Date.now();
    let paginatedUsers: any[] = [];
    
    if (!canUseCache || !allUsers.length) {
      // If we don't have cached users, fetch the specific page
      if (search) {
        // For search, we need all users to filter properly
        console.log(`[${requestId}] Re-fetching all users for search pagination`);
        let page_num = 1;
        let hasMore = true;
        allUsers = [];
        
        while (hasMore) {
          const { data: batchUsers, error: batchError } = await supabase.auth.admin.listUsers({
            perPage: 1000,
            page: page_num
          });
          
          if (batchError) {
            throw new Error(`Failed to fetch users for pagination: ${batchError.message}`);
          }
          
          const batchUserList = batchUsers?.users || [];
          allUsers.push(...batchUserList);
          hasMore = batchUserList.length === 1000;
          page_num++;
          
          if (page_num > 50) break;
        }
        
        // Filter out users without profiles for search pagination as well
        if (allUsers.length > 0) {
          const allUserIds = allUsers.map(user => user.id);
          const { data: existingProfiles, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .in('id', allUserIds);
          
          if (!profileError && existingProfiles) {
            const existingProfileIds = new Set(existingProfiles.map(p => p.id));
            allUsers = allUsers.filter(user => existingProfileIds.has(user.id));
          }
        }
        
        // Filter and paginate
        const filteredUsers = allUsers.filter((user: any) => 
          user.email?.toLowerCase().includes(search.toLowerCase())
        );
        const startIndex = (page - 1) * limit;
        paginatedUsers = filteredUsers.slice(startIndex, startIndex + limit);
      } else {
        // For non-search, we need to fetch more users and filter by profiles to ensure accurate pagination
        console.log(`[${requestId}] Fetching users for non-search pagination with profile filtering`);
        let page_num = 1;
        let hasMore = true;
        let allAuthUsers = [];
        
        // Get enough users to account for those without profiles
        const fetchLimit = Math.max(limit * 3, 100); // Fetch more than needed to account for filtered users
        
        while (hasMore && allAuthUsers.length < fetchLimit) {
          const { data: batchUsers, error: batchError } = await supabase.auth.admin.listUsers({
            perPage: 1000,
            page: page_num
          });
          
          if (batchError) {
            console.error(`[${requestId}] Error fetching auth users:`, batchError);
            throw new Error(`Failed to fetch users: ${batchError.message}`);
          }
          
          const batchUserList = batchUsers?.users || [];
          allAuthUsers.push(...batchUserList);
          hasMore = batchUserList.length === 1000;
          page_num++;
          
          if (page_num > 20) break; // Safety break
        }
        
        // Filter by profiles
        if (allAuthUsers.length > 0) {
          const allUserIds = allAuthUsers.map(user => user.id);
          const { data: existingProfiles, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .in('id', allUserIds);
          
          if (!profileError && existingProfiles) {
            const existingProfileIds = new Set(existingProfiles.map(p => p.id));
            allAuthUsers = allAuthUsers.filter(user => existingProfileIds.has(user.id));
          }
        }
        
        // Apply pagination to filtered results
        const startIndex = (page - 1) * limit;
        paginatedUsers = allAuthUsers.slice(startIndex, startIndex + limit);
      }
    } else {
      // Use cached data for pagination
      const filteredUsers = search ? 
        allUsers.filter((user: any) => user.email?.toLowerCase().includes(search.toLowerCase())) :
        allUsers;
      const startIndex = (page - 1) * limit;
      paginatedUsers = filteredUsers.slice(startIndex, startIndex + limit);
    }
    
    logPerformanceMetrics('Pagination', paginationStartTime, { 
      resultCount: paginatedUsers.length,
      page,
      limit 
    });
    
    // Get user IDs from paginated results for profile enrichment
    const userIds = paginatedUsers.map((user: any) => user.id);
    
    // Phase 4: Enhanced profile fetching with error recovery
    let profiles = [];
    let subscriptions = [];
    if (userIds.length > 0) {
      const profileStartTime = Date.now();
      try {
        // Fetch profiles
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, username, role, created_at')
          .in('id', userIds);
        
        if (profileError) {
          console.error(`[${requestId}] Database error when fetching profiles:`, profileError);
          // Continue with empty profiles rather than failing completely
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
        
        logPerformanceMetrics('Profile and subscription fetching', profileStartTime, { 
          userCount: userIds.length,
          profilesFound: profiles.length,
          subscriptionsFound: subscriptions.length
        });
      } catch (fetchError) {
        console.error(`[${requestId}] Exception during profile/subscription fetch:`, fetchError);
        profiles = [];
        subscriptions = [];
      }
    }
    
    // Merge profile data and subscription data with auth data
    const enrichmentStartTime = Date.now();
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
    
    logPerformanceMetrics('Data enrichment', enrichmentStartTime, { userCount: enrichedUsers.length });
    
    // Calculate final pagination info
    const finalTotalPages = Math.ceil(totalFilteredUsers / limit);
    
    // Phase 3: Enhanced response with performance metadata
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
        cacheHit: canUseCache,
        searchActive: !!search
      }
    };
    
    logPerformanceMetrics('Complete request', startTime, {
      totalUsers,
      filteredUsers: totalFilteredUsers,
      returnedUsers: enrichedUsers.length,
      cacheHit: canUseCache
    });
    
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
    
    // Phase 4: Enhanced error response with more context
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
