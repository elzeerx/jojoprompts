import { createEdgeLogger } from '../../_shared/logger.ts';
import { corsHeaders } from "../../_shared/standardImports.ts";
import { logAdminAction } from "../../shared/securityLogger.ts";

const logger = createEdgeLogger('get-all-users:get-users');

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
  logger.debug('Performance metric', { operation, duration_ms: duration, ...metadata });
}

export async function handleGetUsers(supabase: any, adminId: string, req: Request) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const search = url.searchParams.get('search') || '';
    
    logger.info('Starting getUsersHandler', { requestId, page, limit, search });
    
    // Phase 4: Enhanced validation
    if (page < 1 || limit < 1) {
      logger.warn('Invalid pagination parameters', { requestId, page, limit });
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
      logger.error('Error fetching profiles', { requestId, error: profileError });
      throw new Error(`Failed to fetch user profiles: ${profileError.message}`);
    }

    logPerformanceMetrics('Database profile fetch', searchStartTime, {
      totalFound: totalFilteredUsers,
      pageResults: profiles?.length || 0,
      searchTerm: search || 'none'
    });

    // Handle empty results
    if (!profiles || profiles.length === 0) {
      logger.info('No profiles found for page', { requestId, page });
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

    // Get auth data and roles for the users in this page
    const profileIds = profiles.map(p => p.id);
    const authDataStartTime = Date.now();
    
    // Fetch user roles from user_roles table
    const { data: userRoleData, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', profileIds);
    
    // Create role map (get highest priority role for each user)
    const roleMap = new Map();
    if (userRoleData) {
      userRoleData.forEach(ur => {
        if (!roleMap.has(ur.user_id)) {
          roleMap.set(ur.user_id, ur.role);
        } else {
          // Keep highest priority role
          const currentRole = roleMap.get(ur.user_id);
          const rolePriority = { admin: 1, jadmin: 2, prompter: 3, user: 4 };
          if ((rolePriority[ur.role] || 5) < (rolePriority[currentRole] || 5)) {
            roleMap.set(ur.user_id, ur.role);
          }
        }
      });
    }
    
    let authUserMap = new Map();
    try {
      // Fetch auth data for specific users only
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        logger.warn('Error fetching auth data', { requestId, error: authError });
      } else if (authUsers?.users) {
        // Create efficient lookup map
        authUsers.users.forEach(user => {
          if (profileIds.includes(user.id)) {
            authUserMap.set(user.id, user);
          }
        });
      }
    } catch (authFetchError) {
      logger.warn('Auth data fetch failed', { requestId, error: authFetchError });
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
        logger.warn('Error fetching subscriptions', { requestId, error: subscriptionError });
      } else if (subscriptions) {
        // Map subscriptions, keeping only the most recent for each user
        subscriptions.forEach(sub => {
          if (!subscriptionMap.has(sub.user_id)) {
            subscriptionMap.set(sub.user_id, sub);
          }
        });
      }
    } catch (subFetchError) {
      logger.warn('Subscription fetch failed', { requestId, error: subFetchError });
    }
    
    logPerformanceMetrics('Subscription data fetch', subscriptionStartTime, {
      subscriptionsFound: subscriptionMap.size,
      profileCount: profileIds.length
    });

    // Validation - ensure page doesn't exceed available pages
    const totalPages = Math.ceil((totalFilteredUsers || 0) / limit);
    if (page > totalPages && totalFilteredUsers > 0) {
      logger.warn('Page exceeds available pages', { requestId, page, totalPages });
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
      const userRole = roleMap.get(profile.id) || 'user';

      return {
        // Core identity
        id: profile.id,
        
        // Profile data (complete set of fields)
        first_name: profile.first_name,
        last_name: profile.last_name,
        username: profile.username,
        role: userRole,
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
    
    logger.info('Request completed successfully', { requestId, returnedUsers: enrichedUsers.length });
    
    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    const errorDuration = Date.now() - startTime;
    logger.error('Error in handleGetUsers', { requestId, duration_ms: errorDuration, error: error.message });
    
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
