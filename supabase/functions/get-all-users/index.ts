
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from './cors.ts';
import { verifyAdmin, validateAdminRequest } from './auth.ts';
import { listUsers, deleteUser, updateUser, createUser } from './users.ts';

// Enhanced error response helper
function createErrorResponse(
  message: string, 
  status: number, 
  code?: string,
  details?: Record<string, any>
): Response {
  const errorBody = {
    error: message,
    code: code || `ERROR_${status}`,
    timestamp: new Date().toISOString(),
    ...(details && Object.keys(details).length > 0 ? { details } : {})
  };

  return new Response(JSON.stringify(errorBody), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Enhanced request body parser with validation
async function parseRequestBody(req: Request): Promise<any> {
  try {
    const contentType = req.headers.get('content-type');
    
    if (!contentType?.includes('application/json')) {
      return { action: "list" }; // Default action
    }

    const body = await req.text();
    if (!body || body.trim().length === 0) {
      return { action: "list" };
    }

    const parsed = JSON.parse(body);
    
    // Validate parsed body structure
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Request body must be a valid JSON object');
    }

    // Sanitize action field
    if (parsed.action && typeof parsed.action === 'string') {
      parsed.action = parsed.action.toLowerCase().trim();
      
      // Validate allowed actions
      const allowedActions = ['list', 'delete', 'update', 'create'];
      if (!allowedActions.includes(parsed.action)) {
        parsed.action = 'list'; // Default to safe action
      }
    } else {
      parsed.action = 'list';
    }

    // Validate and sanitize other fields
    if (parsed.userId && typeof parsed.userId === 'string') {
      parsed.userId = parsed.userId.trim();
      // Basic UUID validation
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.userId)) {
        throw new Error('Invalid user ID format');
      }
    }

    return parsed;
  } catch (error: any) {
    console.error('Error parsing request body:', error.message);
    throw new Error(`Invalid request body: ${error.message}`);
  }
}

serve(async (req) => {
  const startTime = Date.now();
  
  try {
    // Handle CORS preflight request
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    // Enhanced request validation
    const requestValidation = validateAdminRequest(req);
    if (!requestValidation.isValid) {
      console.error('Request validation failed:', requestValidation.error);
      return createErrorResponse(
        'Invalid request format',
        400,
        'INVALID_REQUEST',
        { reason: requestValidation.error }
      );
    }

    // Enhanced authentication with proper error handling
    let authContext;
    try {
      authContext = await verifyAdmin(req);
    } catch (authError: any) {
      const message = authError?.message || 'Authentication failed';
      
      if (message.includes('Unauthorized')) {
        return createErrorResponse(
          'Authentication required',
          401,
          'UNAUTHORIZED',
          { reason: 'Invalid or missing authentication credentials' }
        );
      }
      
      if (message.includes('Forbidden')) {
        return createErrorResponse(
          'Access denied',
          403,
          'FORBIDDEN',
          { reason: 'Admin privileges required' }
        );
      }
      
      // Generic server error for unexpected auth failures
      console.error('Unexpected auth error:', authError);
      return createErrorResponse(
        'Authentication service error',
        500,
        'AUTH_ERROR'
      );
    }

    const { supabase, userId } = authContext;

    // Enhanced request body parsing with validation
    let requestData;
    try {
      requestData = await parseRequestBody(req);
    } catch (parseError: any) {
      console.error('Request parsing failed:', parseError.message);
      return createErrorResponse(
        'Invalid request format',
        400,
        'PARSE_ERROR',
        { reason: parseError.message }
      );
    }

    const { action } = requestData;
    let response;

    // Enhanced action handling with proper validation
    try {
      switch (action) {
        case 'delete':
          if (!requestData.userId) {
            return createErrorResponse(
              'User ID required for delete operation',
              400,
              'MISSING_USER_ID'
            );
          }
          response = await deleteUser(supabase, requestData.userId, userId);
          break;
          
        case 'update':
          if (!requestData.userId) {
            return createErrorResponse(
              'User ID required for update operation',
              400,
              'MISSING_USER_ID'
            );
          }
          if (!requestData.userData || typeof requestData.userData !== 'object') {
            return createErrorResponse(
              'User data required for update operation',
              400,
              'MISSING_USER_DATA'
            );
          }
          response = await updateUser(supabase, requestData.userId, requestData.userData, userId);
          break;
          
        case 'create':
          if (!requestData.userData || typeof requestData.userData !== 'object') {
            return createErrorResponse(
              'User data required for create operation',
              400,
              'MISSING_USER_DATA'
            );
          }
          response = await createUser(supabase, requestData.userData, userId);
          break;
          
        default: // 'list' is the default action
          response = await listUsers(supabase, userId);
      }

      // Log successful operation
      const duration = Date.now() - startTime;
      console.log(`Admin operation completed: ${action} by ${userId} in ${duration}ms`);

      return new Response(JSON.stringify({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (operationError: any) {
      console.error(`Operation '${action}' failed:`, {
        error: operationError.message,
        stack: operationError.stack?.substring(0, 500),
        userId,
        action
      });
      
      return createErrorResponse(
        'Operation failed',
        500,
        'OPERATION_ERROR',
        { 
          action,
          reason: operationError.message?.substring(0, 100) // Limit error message length
        }
      );
    }

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('Unhandled error in admin function:', {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    return createErrorResponse(
      'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
});
