import { serve, corsHeaders, createSupabaseClient, handleCors } from "../_shared/standardImports.ts";
import { verifyAdmin, validateAdminRequest, hasPermission, logSecurityEvent } from "../_shared/adminAuth.ts";
import { handleDeleteUser } from "./handlers/deleteUserHandler.ts";
import { handleCreateUser } from "./handlers/createUserHandler.ts";
import { handleUpdateUser } from "./handlers/updateUserHandler.ts";
import { handleGetUsers } from "./handlers/getUsersHandler.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    // Enhanced request validation
    const validation = validateAdminRequest(req);
    if (!validation.isValid) {
      console.error('Request validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Enhanced admin authentication with comprehensive security
    const authContext = await verifyAdmin(req);
    const { supabase, userId, userRole, permissions } = authContext;

    // Log successful admin access
    await logSecurityEvent(supabase, {
      user_id: userId,
      action: 'admin_function_accessed',
      details: { 
        function: 'get-all-users',
        method: req.method,
        role: userRole
      },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent')?.substring(0, 200)
    });

    // Handle different HTTP methods with enhanced security
    switch (req.method) {
      case 'GET':
        // Verify read permissions
        if (!hasPermission(permissions, 'user:read')) {
          await logSecurityEvent(supabase, {
            user_id: userId,
            action: 'permission_denied',
            details: { required_permission: 'user:read', function: 'get-all-users' }
          });
          
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions for user read operations' }), 
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        return await handleGetUsers(supabase, userId, req);

      case 'POST':
        // Parse request body to determine action type
        const requestBody = await req.json();
        const { action } = requestBody;

        if (action === 'delete') {
          // Verify delete permissions
          const hasDeletePermission = hasPermission(permissions, 'user:delete') || 
                                     hasPermission(permissions, 'user:manage') || 
                                     hasPermission(permissions, 'user:write');
          
          if (!hasDeletePermission) {
            await logSecurityEvent(supabase, {
              user_id: userId,
              action: 'permission_denied',
              details: { 
                required_permissions: ['user:delete', 'user:manage', 'user:write'], 
                user_permissions: permissions,
                function: 'get-all-users' 
              }
            });
            
            return new Response(
              JSON.stringify({ error: 'Insufficient permissions for user delete operations' }), 
              { 
                status: 403, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          return await handleDeleteUser(supabase, userId, requestBody);
        } else if (action === 'create') {
          // Verify create permissions
          const hasCreatePermission = hasPermission(permissions, 'user:write') || 
                                     hasPermission(permissions, 'user:manage');
          
          if (!hasCreatePermission) {
            await logSecurityEvent(supabase, {
              user_id: userId,
              action: 'permission_denied',
              details: { 
                required_permissions: ['user:write', 'user:manage'], 
                user_permissions: permissions,
                function: 'get-all-users',
                action: 'create'
              }
            });
            
            return new Response(
              JSON.stringify({ error: 'Insufficient permissions for user creation' }), 
              { 
                status: 403, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          return await handleCreateUser(supabase, userId, requestBody);
        } else if (action === 'update') {
          // Verify write permissions
          const hasUpdatePermission = hasPermission(permissions, 'user:write') || 
                                     hasPermission(permissions, 'user:manage');
          
          if (!hasUpdatePermission) {
            await logSecurityEvent(supabase, {
              user_id: userId,
              action: 'permission_denied',
              details: { 
                required_permissions: ['user:write', 'user:manage'], 
                user_permissions: permissions,
                function: 'get-all-users',
                action: 'update'
              }
            });
            
            return new Response(
              JSON.stringify({ error: 'Insufficient permissions for user updates' }), 
              { 
                status: 403, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          return await handleUpdateUser(supabase, userId, req);
        } else if (action === 'change-password') {
          // Verify super admin permissions (only nawaf@elzeer.com)
          const { data: adminAuth } = await supabase.auth.admin.getUserById(userId);
          const adminEmail = adminAuth?.user?.email;

          if (adminEmail !== 'nawaf@elzeer.com') {
            await logSecurityEvent(supabase, {
              user_id: userId,
              action: 'unauthorized_password_change_attempt',
              details: { 
                attempted_by: adminEmail || 'unknown',
                target_user: requestBody.userId
              }
            });
            
            return new Response(
              JSON.stringify({ error: 'Only super admin can change user passwords' }), 
              { 
                status: 403, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          return await handleCreateUser(supabase, userId, requestBody);
        } else {
          return new Response(
            JSON.stringify({ error: 'Invalid action specified' }), 
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }), 
          { 
            status: 405, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

  } catch (error: any) {
    console.error('[CRITICAL ERROR] get-all-users function failed:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString(),
      method: req.method,
      hasAuthHeader: !!req.headers.get('authorization')
    });

    // Try to log the error if we have a supabase client
    try {      
      const supabase = createSupabaseClient();
      await logSecurityEvent(supabase, {
        action: 'function_error',
        details: { 
          function: 'get-all-users',
          error: error.message,
          method: req.method,
          errorType: error.constructor.name
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      });
    } catch (logError) {
      console.warn('Failed to log error event:', logError);
    }

    // Determine appropriate status code and error message
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let detailedMessage = 'An unexpected error occurred';
    
    if (error.message.includes('Unauthorized')) {
      statusCode = 401;
      errorMessage = 'Unauthorized';
      detailedMessage = error.message;
    } else if (error.message.includes('Forbidden') || error.message.includes('Access denied')) {
      statusCode = 403;
      errorMessage = 'Forbidden';
      detailedMessage = error.message;
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        message: detailedMessage,
        code: errorMessage.toUpperCase().replace(/\s+/g, '_')
      }), 
      { 
        status: statusCode, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
