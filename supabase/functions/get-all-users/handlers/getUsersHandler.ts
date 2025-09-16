
import { corsHeaders } from "../../_shared/standardImports.ts";
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

    // Optimized approach: Use database-level pagination and search
    const searchStartTime = Date.now();
    
    // Build the comprehensive profile query with all fields
    let profileQuery = supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        username,
        role,
        bio,
        avatar_url,
        country,
        phone_number,
        timezone,
        membership_tier,
        social_links,
        created_at
      `, { count: 'exact' });

    // Apply search filter on multiple fields
    if (search) {
      profileQuery = profileQuery.or(`
        first_name.ilike.%${search}%,
        last_name.ilike.%${search}%,
        username.ilike.%${search}%,
        email.ilike.%${search}%
      `);
    }

    // Apply pagination at database level
    const offset = (page - 1) * limit;
    profileQuery = profileQuery
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: profiles, error: profileError, count: totalFilteredUsers } = await profileQuery;

    if (profileError) {
      console.error(`[${requestId}] Error fetching profiles:`, profileError);
      throw new Error(`Failed to fetch user profiles: ${profileError.message}`);
    }

    logPerformanceMetrics('Database profile fetch', searchStartTime, {
      totalFound: totalFilteredUsers,
      pageResults: profiles?.length || 0,
      searchTerm: search || 'none'
    });

    // Handle empty results
    if (!profiles || profiles.length === 0) {
      console.log(`[${requestId}] No profiles found for page ${page}`);
      return new Response(
        JSON.stringify({
          users: [],
          total: totalFilteredUsers || 0,
          totalUsers: totalFilteredUsers || 0,
          page,
          limit,
          totalPages: 0,
          performance: {
            requestId,
            totalDuration: Date.now() - startTime,
            cacheHit: false,
            searchActive: !!search
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get auth data for the users in this page
    const profileIds = profiles.map(p => p.id);
    const authDataStartTime = Date.now();
    
    let authUserMap = new Map();
    try {
      // Fetch auth data for specific users only
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.warn(`[${requestId}] Error fetching auth data:`, authError);
      } else if (authUsers?.users) {
        // Create efficient lookup map
        authUsers.users.forEach(user => {
          if (profileIds.includes(user.id)) {
            authUserMap.set(user.id, user);
          }
        });
      }
    } catch (authFetchError) {
      console.warn(`[${requestId}] Auth data fetch failed:`, authFetchError);
    }
    
    logPerformanceMetrics('Auth data fetch', authDataStartTime, {
      authUsersFound: authUserMap.size,
      profileCount: profileIds.length
    });

    // Get subscription data for the users in this page
    const subscriptionStartTime = Date.now();
    let subscriptionMap = new Map();
    
    try {
      const { data: subscriptions, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select(`
          user_id,
          status,
          start_date,
          end_date,
          payment_method,
          created_at,
          subscription_plans!inner(
            id,
            name,
            price_usd,
            is_lifetime,
            duration_days
          )
        `)
        .in('user_id', profileIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (subscriptionError) {
        console.warn(`[${requestId}] Error fetching subscriptions:`, subscriptionError);
      } else if (subscriptions) {
        // Map subscriptions, keeping only the most recent for each user
        subscriptions.forEach(sub => {
          if (!subscriptionMap.has(sub.user_id)) {
            subscriptionMap.set(sub.user_id, sub);
          }
        });
      }
    } catch (subFetchError) {
      console.warn(`[${requestId}] Subscription fetch failed:`, subFetchError);
    }
    
    logPerformanceMetrics('Subscription data fetch', subscriptionStartTime, {
      subscriptionsFound: subscriptionMap.size,
      profileCount: profileIds.length
    });

    // Validation - ensure page doesn't exceed available pages
    const totalPages = Math.ceil((totalFilteredUsers || 0) / limit);
    if (page > totalPages && totalFilteredUsers > 0) {
      console.warn(`[${requestId}] Page ${page} exceeds available pages ${totalPages}`);
      return new Response(
        JSON.stringify({ 
          error: 'Page exceeds available data',
          redirect: { page: Math.max(1, totalPages), totalPages },
          total: totalFilteredUsers,
          totalUsers: totalFilteredUsers
        }), 
        { 
          status: 416,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Combine all data efficiently
    const enrichmentStartTime = Date.now();
    const enrichedUsers = profiles.map((profile: any) => {
      const authUser = authUserMap.get(profile.id);
      const subscription = subscriptionMap.get(profile.id);

      return {
        // Core identity
        id: profile.id,
        
        // Profile data (complete set of fields)
        first_name: profile.first_name,
        last_name: profile.last_name,
        username: profile.username,
        role: profile.role || 'user',
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        country: profile.country,
        phone_number: profile.phone_number,
        timezone: profile.timezone,
        membership_tier: profile.membership_tier || 'free',
        social_links: profile.social_links || {},
        created_at: profile.created_at,
        
        // Auth data (when available)
        email: authUser?.email || null,
        email_confirmed_at: authUser?.email_confirmed_at || null,
        is_email_confirmed: !!authUser?.email_confirmed_at,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        auth_created_at: authUser?.created_at || null,
        auth_updated_at: authUser?.updated_at || null,
        
        // Subscription data (when available)
        subscription: subscription ? {
          plan_id: subscription.subscription_plans?.id,
          plan_name: subscription.subscription_plans?.name || 'Unknown',
          price_usd: subscription.subscription_plans?.price_usd || 0,
          is_lifetime: subscription.subscription_plans?.is_lifetime || false,
          duration_days: subscription.subscription_plans?.duration_days,
          status: subscription.status,
          start_date: subscription.start_date,
          end_date: subscription.end_date,
          payment_method: subscription.payment_method,
          subscription_created_at: subscription.created_at
        } : null
      };
    });
    
    logPerformanceMetrics('Data enrichment', enrichmentStartTime, { 
      userCount: enrichedUsers.length,
      authDataAvailable: authUserMap.size,
      subscriptionDataAvailable: subscriptionMap.size
    });
    
    // Calculate final pagination info
    const finalTotalPages = Math.ceil((totalFilteredUsers || 0) / limit);
    
    // Enhanced response with performance metadata
    const responseData = {
      users: enrichedUsers,
      total: totalFilteredUsers || 0,
      totalUsers: totalFilteredUsers || 0,
      page,
      limit,
      totalPages: finalTotalPages,
      performance: {
        requestId,
        totalDuration: Date.now() - startTime,
        cacheHit: false, // We're not using cache in this optimized version
        searchActive: !!search,
        dataEnrichment: {
          profilesEnriched: enrichedUsers.length,
          authDataAvailable: authUserMap.size,
          subscriptionsAvailable: subscriptionMap.size
        }
      }
    };
    
    logPerformanceMetrics('Complete request', startTime, {
      totalFiltered: totalFilteredUsers || 0,
      returnedUsers: enrichedUsers.length,
      searchActive: !!search,
      databaseOptimized: true
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
