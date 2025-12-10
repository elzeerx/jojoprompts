
import { serve, corsHeaders, createSupabaseClient, createClient, handleCors, createErrorResponse, createSuccessResponse } from "../_shared/standardImports.ts";
import { verifyAdmin, hasPermission, logSecurityEvent, validateAdminRequest } from "../_shared/adminAuth.ts";
import { createEdgeLogger } from "../_shared/logger.ts";

const logger = createEdgeLogger('CANCEL_SUBSCRIPTION');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    // Enhanced request validation
    const validation = validateAdminRequest(req);
    if (!validation.isValid) {
      logger.error('Request validation failed', { error: validation.error });
      return createErrorResponse(validation.error!, 400);
    }

    // Enhanced admin authentication with comprehensive security
    const authContext = await verifyAdmin(req);
    const { supabase, userId, userRole, permissions } = authContext;

    // Verify subscription management permissions (check multiple possible permissions)
    const hasSubscriptionPermission = hasPermission(permissions, 'subscription:manage') || 
                                     hasPermission(permissions, 'subscription:cancel') || 
                                     hasPermission(permissions, 'subscription:write');
    
    if (!hasSubscriptionPermission) {
      await logSecurityEvent(supabase, {
        user_id: userId,
        action: 'permission_denied',
        details: { 
          required_permissions: ['subscription:manage', 'subscription:cancel', 'subscription:write'], 
          user_permissions: permissions,
          function: 'cancel-subscription',
          attempted_role: userRole
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent')?.substring(0, 200)
      });
      
      return createErrorResponse('Insufficient permissions for subscription management', 403);
    }

    // Log successful admin access
    await logSecurityEvent(supabase, {
      user_id: userId,
      action: 'admin_subscription_cancel_accessed',
      details: { 
        function: 'cancel-subscription',
        method: req.method,
        role: userRole
      },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent')?.substring(0, 200)
    });

    const requestBody = await req.json();
    const { userId: targetUserId } = requestBody;

    if (!targetUserId) {
      return createErrorResponse('User ID is required', 400);
    }

    // Log the subscription cancellation attempt
    await logSecurityEvent(supabase, {
      user_id: userId,
      action: 'subscription_cancel_attempt',
      details: { 
        target_user_id: targetUserId,
        admin_id: userId,
        admin_role: userRole
      }
    });

    // Extract Bearer token from the request
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('Missing or invalid authorization header', 401);
    }
    const userToken = authHeader.substring(7); // Remove "Bearer " prefix

    // Create user-scoped Supabase client for RPC call (so auth.uid() works correctly)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseAsUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      }
    });

    // Call the database function using user-scoped client
    const { data, error } = await supabaseAsUser.rpc('cancel_user_subscription', {
      _user_id: targetUserId,
      _admin_id: userId
    });

    if (error) {
      // Log the error
      await logSecurityEvent(supabase, {
        user_id: userId,
        action: 'subscription_cancel_failed',
        details: { 
          target_user_id: targetUserId,
          error: error.message,
          admin_id: userId
        }
      });
      throw error;
    }

    // Log successful cancellation
    await logSecurityEvent(supabase, {
      user_id: userId,
      action: 'subscription_cancel_success',
      details: { 
        target_user_id: targetUserId,
        admin_id: userId,
        result: data
      }
    });

    return createSuccessResponse(data);

  } catch (error: any) {
    logger.error('Cancel subscription failed', { error: error.message });
    
    // Try to log the error if possible
    try {
      const supabase = createSupabaseClient();
      await logSecurityEvent(supabase, {
        action: 'function_error',
        details: { 
          function: 'cancel-subscription',
          error: error.message,
          method: req.method
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      });
    } catch (logError: any) {
      logger.warn('Failed to log error event', { error: logError.message });
    }
    
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});
