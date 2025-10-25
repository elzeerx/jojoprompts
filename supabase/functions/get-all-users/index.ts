import { serve, corsHeaders, handleCors, createErrorResponse, createSuccessResponse } from "../_shared/standardImports.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";
import { createEdgeLogger } from "../_shared/logger.ts";
import { handleGetUsers } from "./handlers/getUsersHandler.ts";

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
