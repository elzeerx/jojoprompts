import { serve, corsHeaders, handleCors, createErrorResponse, createSuccessResponse } from "../_shared/standardImports.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";
import { createEdgeLogger } from "../_shared/logger.ts";

const logger = createEdgeLogger('GET_ALL_USERS');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    // Admin authentication using shared module
    const { supabase, userId } = await verifyAdmin(req);
    
    // Handle GET - list users with pagination and search
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const search = url.searchParams.get('search') || '';
      
      const offset = (page - 1) * limit;
      
      logger.info("Fetching users", { page, limit, search });
      
      // Build query
      let query = supabase
        .from('profiles')
        .select('*, user_subscriptions(*, subscription_plans(*))', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (search) {
        query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      }
      
      const { data: profiles, error, count } = await query;
      
      if (error) {
        logger.error('User fetch error', { error: error.message });
        throw error;
      }
      
      logger.info("Users fetched successfully", { count, returned: profiles?.length || 0 });
      
      return createSuccessResponse({
        users: profiles,
        total: count,
        totalPages: Math.ceil((count || 0) / limit)
      });
    }
    
    // Handle POST - delete/update operations
    if (req.method === 'POST') {
      // Check if POST has a body
      const contentLength = req.headers.get('content-length');
      const hasBody = contentLength && parseInt(contentLength) > 0;
      
      if (!hasBody) {
        // Empty POST body - treat as GET request for user list
        logger.info("POST request with no body, redirecting to GET logic");
        
        const url = new URL(req.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const search = url.searchParams.get('search') || '';
        
        const offset = (page - 1) * limit;
        
        logger.info("Fetching users", { page, limit, search });
        
        // Build query
        let query = supabase
          .from('profiles')
          .select('*, user_subscriptions(*, subscription_plans(*))', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        
        if (search) {
          query = query.or(`email.ilike.%${search}%,username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
        }
        
        const { data: profiles, error, count } = await query;
        
        if (error) {
          logger.error('User fetch error', { error: error.message });
          throw error;
        }
        
        logger.info("Users fetched successfully", { count, returned: profiles?.length || 0 });
        
        return createSuccessResponse({
          users: profiles,
          total: count,
          totalPages: Math.ceil((count || 0) / limit)
        });
      }
      
      // Safely parse body
      let body;
      try {
        body = await req.json();
      } catch (parseError: any) {
        logger.error('Failed to parse POST body', { error: parseError.message });
        return createErrorResponse('Invalid JSON body', 400);
      }
      
      const { action, userId: targetUserId } = body;
      
      logger.info("User action requested", { action, targetUserId });
      
      if (action === 'delete') {
        // Call the existing admin_delete_user_data function
        const { data, error } = await supabase.rpc('admin_delete_user_data', {
          target_user_id: targetUserId
        });
        
        if (error) {
          logger.error('User deletion failed', { error: error.message, targetUserId });
          throw error;
        }
        
        logger.info("User deleted successfully", { targetUserId });
        
        return createSuccessResponse(data);
      }
      
      return createErrorResponse('Invalid action', 400);
    }
    
    return createErrorResponse('Method not allowed', 405);

  } catch (error: any) {
    logger.error('Function error', {
      error: error.message,
      method: req.method,
      hasAuth: !!req.headers.get('authorization')
    });

    // Determine appropriate status code based on error
    const status = error.message === 'UNAUTHORIZED' ? 401 :
                   error.message === 'FORBIDDEN' ? 403 : 500;
    
    return createErrorResponse(error.message, status);
  }
});
