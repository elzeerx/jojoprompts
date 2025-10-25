import { corsHeaders, handleCors, createErrorResponse, createSuccessResponse } from "../_shared/standardImports.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";
import { createEdgeLogger, generateRequestId } from "../_shared/logger.ts";

const logger = createEdgeLogger('ADMIN_USERS_V2');

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

interface UserResponse {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email?: string;
  role: string;
  created_at: string;
  last_sign_in_at?: string;
  subscription?: {
    id: string;
    status: string;
    plan_name?: string;
    start_date: string;
    end_date?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  const startTime = Date.now();

  try {
    // Admin authentication using shared module
    const { supabase, userId, userRole } = await verifyAdmin(req);
    logger.info('Admin authenticated', { userId, userRole });

    // Route based on method
    if (req.method === 'GET') {
      return await handleGetUsers(supabase, req, startTime);
    } else if (req.method === 'POST') {
      return await handlePostOperation(supabase, req, startTime);
    } else {
      return createErrorResponse('Method not allowed', 405);
    }

  } catch (error: any) {
    logger.error('Request failed', { error: error.message });
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});

async function handleGetUsers(supabase: any, req: Request, startTime: number) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const search = url.searchParams.get('search') || '';
  const offset = (page - 1) * limit;

  logger.debug('Get users request', { page, limit, search });

  // Check cache
  const cacheKey = `users_${page}_${limit}_${search}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug('Cache hit', { cacheKey });
    return new Response(
      JSON.stringify({
        ...cached.data,
        cached: true,
        performance: { duration_ms: Date.now() - startTime }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build the optimized query
  let query = supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      username,
      email,
      created_at,
      user_roles!inner(role),
      user_subscriptions(
        id,
        status,
        start_date,
        end_date,
        subscription_plans(name)
      )
    `, { count: 'exact' });

  // Apply search filter
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,username.ilike.%${search}%,email.ilike.%${search}%`);
  }

  // Apply pagination
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: profiles, error: profilesError, count } = await query;

  if (profilesError) {
    logger.error('Query failed', { error: profilesError.message });
    return new Response(
      JSON.stringify({ error: profilesError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get auth metadata separately (auth.users not accessible via REST API)
  const userIds = profiles?.map(p => p.id) || [];
  const authMetadata = new Map();

  for (const userId of userIds) {
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      if (authUser?.user) {
        authMetadata.set(userId, {
          email: authUser.user.email,
          last_sign_in_at: authUser.user.last_sign_in_at,
          email_confirmed_at: authUser.user.email_confirmed_at
        });
      }
    } catch (error: any) {
      logger.warn('Auth metadata fetch failed', { userId, error: error.message });
    }
  }

  // Transform and enrich the data
  const users: UserResponse[] = profiles?.map(profile => {
    const auth = authMetadata.get(profile.id) || {};
    const role = profile.user_roles?.[0]?.role || 'user';
    const subscription = profile.user_subscriptions?.[0];

    return {
      id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      username: profile.username,
      email: auth.email || profile.email,
      role: role,
      created_at: profile.created_at,
      last_sign_in_at: auth.last_sign_in_at,
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        plan_name: subscription.subscription_plans?.name,
        start_date: subscription.start_date,
        end_date: subscription.end_date
      } : undefined
    };
  }) || [];

  const totalPages = Math.ceil((count || 0) / limit);
  const duration = Date.now() - startTime;

  const response = {
    users,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages
    },
    performance: {
      duration_ms: duration,
      query_count: 1,
      cached: false
    }
  };

  // Cache the response
  cache.set(cacheKey, { data: response, timestamp: Date.now() });

  logger.info('Users retrieved', { count: users.length, duration_ms: duration });

  return new Response(
    JSON.stringify(response),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handlePostOperation(supabase: any, req: Request, startTime: number) {
  const body = await req.json();
  const { operation, userId, data } = body;

  logger.debug('Post operation', { operation, userId });

  try {
    switch (operation) {
      case 'delete': {
        // Call the admin delete function
        const { data: result, error } = await supabase.rpc('admin_delete_user_data', {
          target_user_id: userId
        });

        if (error) throw error;

        // Invalidate cache
        cache.clear();

        return new Response(
          JSON.stringify({
            success: true,
            message: 'User deleted successfully',
            result,
            performance: { duration_ms: Date.now() - startTime }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        // Update profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update(data)
          .eq('id', userId);

        if (profileError) throw profileError;

        // Update role if provided
        if (data.role) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .upsert({
              user_id: userId,
              role: data.role
            }, {
              onConflict: 'user_id,role'
            });

          if (roleError) throw roleError;
        }

        // Invalidate cache
        cache.clear();

        return new Response(
          JSON.stringify({
            success: true,
            message: 'User updated successfully',
            performance: { duration_ms: Date.now() - startTime }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown operation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    logger.error('Post operation failed', { operation, error: error.message });
    return new Response(
      JSON.stringify({ 
        error: error.message,
        operation,
        performance: { duration_ms: Date.now() - startTime }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
