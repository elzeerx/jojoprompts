import { serve, corsHeaders, handleCors, createErrorResponse, createSuccessResponse } from "../_shared/standardImports.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";
import { createEdgeLogger } from "../_shared/logger.ts";
import { handleGetUsers } from "./handlers/getUsersHandler.ts";
import { handleUpdateUser } from "./handlers/updateUserHandler.ts";
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from "../_shared/rateLimit.ts";

const logger = createEdgeLogger('GET_ALL_USERS');

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    // Admin authentication using shared module
    const { supabase, userId } = await verifyAdmin(req);
    
    // Check rate limit for admin user
    const rateLimitResult = await checkRateLimit(supabase, userId, RATE_LIMITS.GET_ALL_USERS);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for admin user', {
        userId,
        endpoint: 'get-all-users',
        currentCount: rateLimitResult.currentCount,
        limit: rateLimitResult.limit
      });
      
      // Log rate limit violation
      await supabase.from('admin_audit_log').insert({
        admin_user_id: userId,
        action: 'rate_limit_exceeded',
        target_resource: 'get-all-users',
        metadata: {
          rate_limit_details: rateLimitResult,
          method: req.method
        }
      });
      
      return createRateLimitResponse(rateLimitResult, corsHeaders);
    }
    
    // Handle GET - list users with pagination and search
    if (req.method === 'GET') {
      return await handleGetUsers(supabase, userId, req);
    }
    
    // Handle POST - delete/update operations
    if (req.method === 'POST') {
      // Check if POST has a body
      const contentLength = req.headers.get('content-length');
      const hasBody = contentLength && parseInt(contentLength) > 0;
      
      if (!hasBody) {
        // Empty POST body - treat as GET request for user list
        logger.info("POST request with no body, redirecting to GET logic");
        return await handleGetUsers(supabase, userId, req);
      }
      
      // Safely parse body
      let body;
      try {
        body = await req.json();
      } catch (parseError: unknown) {
        logger.error('Failed to parse POST body', {
          error: getErrorMessage(parseError)
        });
        return createErrorResponse('Invalid JSON body', 400);
      }
      
      const { action, userId: targetUserId } = body;
      
      logger.info("User action requested", { action, targetUserId });

      if (action === 'list') {
        return await handleGetUsers(supabase, userId, req, {
          page: body.page,
          limit: body.limit,
          search: body.search
        });
      }
      
      if (action === 'delete') {
        // Call the admin_delete_user_data function with verified admin ID
        const { data, error } = await supabase.rpc('admin_delete_user_data', {
          target_user_id: targetUserId,
          admin_user_id: userId  // Pass the verified admin ID for authorization
        });
        
        if (error) {
          logger.error('User deletion failed', { error: error.message, targetUserId });
          throw error;
        }
        
        logger.info("User deleted successfully", { targetUserId });
        
        return createSuccessResponse(data);
      }
      
      if (action === 'update') {
        logger.info("User update requested", { targetUserId: body.userId });
        return await handleUpdateUser(supabase, userId, req, body);
      }
      
      return createErrorResponse('Invalid action', 400);
    }
    
    return createErrorResponse('Method not allowed', 405);

  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    logger.error('Function error', {
      error: errorMessage,
      method: req.method,
      hasAuth: !!req.headers.get('authorization')
    });

    // Determine appropriate status code based on error
    const status = errorMessage === 'UNAUTHORIZED' ? 401 :
                   errorMessage === 'FORBIDDEN' ? 403 : 500;
    
    return createErrorResponse(errorMessage, status);
  }
});
