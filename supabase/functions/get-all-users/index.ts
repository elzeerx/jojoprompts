
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from "./cors.ts";
import { verifyAdmin, validateAdminRequest, hasPermission } from "./auth.ts";
import { logSecurityEvent } from "../shared/securityLogger.ts";
import { handleGetUsers } from "./handlers/getUsersHandler.ts";
import { handleCreateUser } from "./handlers/createUserHandler.ts";
import { handleUpdateUser } from "./handlers/updateUserHandler.ts";
import { handleDeleteUser } from "./handlers/deleteUserHandler.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
        try {
          // Parse request body to check for action type
          const postRequestBody = await req.json();
          
          console.log('[POST] Received request body:', { action: postRequestBody.action, userId: postRequestBody.userId });
          
          // Handle delete actions sent via POST
          if (postRequestBody.action === 'delete') {
            console.log('[POST] Processing delete action for user:', postRequestBody.userId);
            
            // Verify delete permissions for delete actions
            if (!hasPermission(permissions, 'user:delete')) {
              await logSecurityEvent(supabase, {
                user_id: userId,
                action: 'permission_denied',
                details: { required_permission: 'user:delete', function: 'get-all-users' }
              });

              return new Response(
                JSON.stringify({ error: 'Insufficient permissions for user delete operations' }), 
                { 
                  status: 403, 
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                }
              );
            }

            return await handleDeleteUser(supabase, userId, postRequestBody);
          }
          
          // For non-delete actions, verify write permissions
          if (!hasPermission(permissions, 'user:write')) {
            await logSecurityEvent(supabase, {
              user_id: userId,
              action: 'permission_denied',
              details: { required_permission: 'user:write', function: 'get-all-users' }
            });

            return new Response(
              JSON.stringify({ error: 'Insufficient permissions for user write operations' }), 
              { 
                status: 403, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }

          // Clone the request with the already parsed body for create user handler
          const createRequest = new Request(req.url, {
            method: req.method,
            headers: req.headers,
            body: JSON.stringify(postRequestBody)
          });
          
          return await handleCreateUser(supabase, userId, createRequest);
        } catch (error: any) {
          console.error('[POST] Error processing POST request:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to process POST request', details: error.message }), 
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

      case 'PUT':
        // Verify write permissions
        if (!hasPermission(permissions, 'user:write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions for user update operations' }), 
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        return await handleUpdateUser(supabase, userId, req);

      case 'DELETE':
        // Verify delete permissions
        if (!hasPermission(permissions, 'user:delete')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions for user delete operations' }), 
            { 
              status: 403, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Parse the request body for DELETE requests
        const requestBody = await req.json();
        return await handleDeleteUser(supabase, userId, requestBody);

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
    console.error('Critical error in get-all-users function:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString()
    });

    // Try to log the error if we have a supabase client
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
      
      if (supabaseUrl && serviceRoleKey) {
        const errorClient = createClient(supabaseUrl, serviceRoleKey);
        await logSecurityEvent(errorClient, {
          action: 'function_error',
          details: { 
            function: 'get-all-users',
            error: error.message,
            method: req.method
          },
          ip_address: req.headers.get('x-forwarded-for') || 'unknown'
        });
      }
    } catch (logError) {
      console.warn('Failed to log error event:', logError);
    }

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'An unexpected error occurred' 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
