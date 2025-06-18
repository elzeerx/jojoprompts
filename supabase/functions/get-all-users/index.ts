
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from './cors.ts';
import { verifyAdmin, validateAdminRequest, hasPermission } from './auth.ts';
import { listUsers, deleteUser, updateUser, createUser } from './users.ts';

// Enhanced parameter validation schemas
const VALIDATION_SCHEMAS = {
  delete: {
    userId: { required: true, type: 'uuid' as const }
  },
  update: {
    userId: { required: true, type: 'uuid' as const },
    userData: { required: true, type: 'object' as const }
  },
  create: {
    userData: { required: true, type: 'object' as const }
  }
};

// Enhanced error response helper with security considerations
function createErrorResponse(
  message: string, 
  status: number, 
  code?: string,
  details?: Record<string, any>
): Response {
  // Sanitize error details to prevent information leakage
  const sanitizedDetails = details ? sanitizeErrorDetails(details) : {};
  
  const errorBody = {
    error: message,
    code: code || `ERROR_${status}`,
    timestamp: new Date().toISOString(),
    ...(Object.keys(sanitizedDetails).length > 0 ? { details: sanitizedDetails } : {})
  };

  return new Response(JSON.stringify(errorBody), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Sanitize error details to prevent sensitive information exposure
function sanitizeErrorDetails(details: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const allowedFields = ['action', 'reason', 'field', 'operation'];
  
  for (const [key, value] of Object.entries(details)) {
    if (allowedFields.includes(key)) {
      if (typeof value === 'string') {
        // Remove potentially sensitive information
        sanitized[key] = value
          .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '[UUID]')
          .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
          .substring(0, 100); // Limit length
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
}

// Enhanced request body parser with comprehensive validation
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

    // Check body size limit
    if (body.length > 100000) { // 100KB limit
      throw new Error('Request body too large');
    }

    const parsed = JSON.parse(body);
    
    // Enhanced body structure validation
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Request body must be a valid JSON object');
    }

    // Validate and sanitize action field
    if (parsed.action && typeof parsed.action === 'string') {
      parsed.action = parsed.action.toLowerCase().trim();
      
      // Validate allowed actions with enhanced security
      const allowedActions = ['list', 'delete', 'update', 'create'];
      if (!allowedActions.includes(parsed.action)) {
        console.warn('Invalid action attempted:', parsed.action);
        parsed.action = 'list'; // Default to safe action
      }
    } else {
      parsed.action = 'list';
    }

    // Enhanced UUID validation
    if (parsed.userId) {
      if (typeof parsed.userId !== 'string') {
        throw new Error('User ID must be a string');
      }
      
      parsed.userId = parsed.userId.trim();
      
      // Strict UUID validation
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.userId)) {
        throw new Error('Invalid user ID format - must be a valid UUID');
      }
    }

    // Enhanced user data validation
    if (parsed.userData) {
      if (typeof parsed.userData !== 'object' || Array.isArray(parsed.userData)) {
        throw new Error('User data must be a valid object');
      }
      
      // Validate user data fields
      const userDataResult = validateUserData(parsed.userData);
      if (!userDataResult.isValid) {
        throw new Error(`Invalid user data: ${userDataResult.errors.join(', ')}`);
      }
      
      parsed.userData = userDataResult.sanitizedData;
    }

    return parsed;
  } catch (error: any) {
    console.error('Error parsing request body:', {
      error: error.message,
      bodyLength: req.headers.get('content-length'),
      contentType: req.headers.get('content-type')
    });
    throw new Error(`Invalid request body: ${error.message}`);
  }
}

// Validate user data with comprehensive security checks
function validateUserData(userData: any): { 
  isValid: boolean; 
  errors: string[]; 
  sanitizedData: any 
} {
  const errors: string[] = [];
  const sanitizedData: any = {};
  
  // Define allowed fields and their validation rules
  const allowedFields = {
    email: { type: 'string', maxLength: 320, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    firstName: { type: 'string', maxLength: 50, minLength: 1 },
    lastName: { type: 'string', maxLength: 50, minLength: 1 },
    role: { type: 'string', allowedValues: ['user', 'admin', 'jadmin', 'prompter'] }
  };
  
  // Check for unexpected fields
  for (const field of Object.keys(userData)) {
    if (!allowedFields[field as keyof typeof allowedFields]) {
      errors.push(`Unexpected field: ${field}`);
    }
  }
  
  // Validate allowed fields
  for (const [field, rules] of Object.entries(allowedFields)) {
    const value = userData[field];
    
    if (value !== undefined && value !== null) {
      // Type validation
      if (typeof value !== rules.type) {
        errors.push(`Field ${field} must be a ${rules.type}`);
        continue;
      }
      
      if (rules.type === 'string') {
        const strValue = value as string;
        
        // Length validation
        if (rules.minLength && strValue.length < rules.minLength) {
          errors.push(`Field ${field} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && strValue.length > rules.maxLength) {
          errors.push(`Field ${field} must be at most ${rules.maxLength} characters`);
        }
        
        // Pattern validation
        if (rules.pattern && !rules.pattern.test(strValue)) {
          errors.push(`Field ${field} has invalid format`);
        }
        
        // Allowed values validation
        if (rules.allowedValues && !rules.allowedValues.includes(strValue)) {
          errors.push(`Field ${field} must be one of: ${rules.allowedValues.join(', ')}`);
        }
        
        // Security validation - check for malicious content
        if (containsMaliciousContent(strValue)) {
          errors.push(`Field ${field} contains invalid content`);
        }
        
        // Sanitize the value if no errors
        if (errors.length === 0) {
          sanitizedData[field] = strValue.trim();
        }
      } else {
        sanitizedData[field] = value;
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
}

// Check for malicious content in strings
function containsMaliciousContent(input: string): boolean {
  const maliciousPatterns = [
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /(union|select|insert|delete|update|drop|create|alter)\s+/i,
    /[<>'"]/g.test(input) && input.includes('=')
  ];
  
  return maliciousPatterns.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(input);
    }
    return false;
  });
}

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  console.log(`[${requestId}] Admin request started:`, {
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('user-agent')?.substring(0, 100),
    timestamp: new Date().toISOString()
  });
  
  try {
    // Handle CORS preflight request
    const corsResponse = handleCors(req);
    if (corsResponse) {
      console.log(`[${requestId}] CORS preflight handled`);
      return corsResponse;
    }

    // Enhanced request validation with security focus
    const requestValidation = validateAdminRequest(req);
    if (!requestValidation.isValid) {
      console.error(`[${requestId}] Request validation failed:`, requestValidation.error);
      return createErrorResponse(
        'Invalid request format',
        400,
        'INVALID_REQUEST',
        { reason: requestValidation.error }
      );
    }

    // Enhanced authentication with comprehensive security checks
    let authContext;
    try {
      authContext = await verifyAdmin(req);
      console.log(`[${requestId}] Authentication successful for user:`, authContext.userId);
    } catch (authError: any) {
      const message = authError?.message || 'Authentication failed';
      
      console.error(`[${requestId}] Authentication failed:`, {
        error: message,
        timestamp: new Date().toISOString()
      });
      
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
          { reason: 'Administrative privileges required' }
        );
      }
      
      // Generic server error for unexpected auth failures
      return createErrorResponse(
        'Authentication service error',
        500,
        'AUTH_ERROR'
      );
    }

    const { supabase, userId, permissions } = authContext;

    // Enhanced request body parsing with validation
    let requestData;
    try {
      requestData = await parseRequestBody(req);
      console.log(`[${requestId}] Request parsed successfully:`, { action: requestData.action });
    } catch (parseError: any) {
      console.error(`[${requestId}] Request parsing failed:`, parseError.message);
      return createErrorResponse(
        'Invalid request format',
        400,
        'PARSE_ERROR',
        { reason: parseError.message }
      );
    }

    const { action } = requestData;
    let response;

    // Enhanced action handling with permission checks
    try {
      switch (action) {
        case 'delete':
          // Check delete permission
          if (!hasPermission(permissions, 'user:delete')) {
            console.warn(`[${requestId}] Insufficient permissions for delete action`);
            return createErrorResponse(
              'Insufficient permissions',
              403,
              'PERMISSION_DENIED',
              { action: 'delete', required: 'user:delete' }
            );
          }
          
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
          // Check update permission
          if (!hasPermission(permissions, 'user:write')) {
            console.warn(`[${requestId}] Insufficient permissions for update action`);
            return createErrorResponse(
              'Insufficient permissions',
              403,
              'PERMISSION_DENIED',
              { action: 'update', required: 'user:write' }
            );
          }
          
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
          // Check create permission
          if (!hasPermission(permissions, 'user:write')) {
            console.warn(`[${requestId}] Insufficient permissions for create action`);
            return createErrorResponse(
              'Insufficient permissions',
              403,
              'PERMISSION_DENIED',
              { action: 'create', required: 'user:write' }
            );
          }
          
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
          // Check read permission
          if (!hasPermission(permissions, 'user:read')) {
            console.warn(`[${requestId}] Insufficient permissions for list action`);
            return createErrorResponse(
              'Insufficient permissions',
              403,
              'PERMISSION_DENIED',
              { action: 'list', required: 'user:read' }
            );
          }
          
          response = await listUsers(supabase, userId);
      }

      // Log successful operation
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] Admin operation completed:`, {
        action,
        userId,
        duration: `${duration}ms`,
        success: true
      });

      return new Response(JSON.stringify({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (operationError: any) {
      console.error(`[${requestId}] Operation '${action}' failed:`, {
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
    console.error(`[${requestId}] Unhandled error in admin function:`, {
      error: error.message,
      stack: error.stack?.substring(0, 500),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    return createErrorResponse(
      'Internal server error',
      500,
      'INTERNAL_ERROR',
      { requestId }
    );
  }
});
