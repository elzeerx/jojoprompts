import { serve } from "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from "./cors.ts";
import { verifyAdmin, validateAdminRequest, hasPermission } from "./auth.ts";
import { ParameterValidator } from "../shared/parameterValidator.ts";
import { logSecurityEvent, logAdminAction } from "../shared/securityLogger.ts";

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
        // Verify write permissions
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

        return await handleCreateUser(supabase, userId, req);

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

        return await handleDeleteUser(supabase, userId, req);

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

async function handleGetUsers(supabase: any, adminId: string, req: Request) {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const search = url.searchParams.get('search') || '';
    
    // Validate pagination parameters
    if (page < 1 || limit < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid pagination parameters' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the user list access
    await logAdminAction(supabase, adminId, 'list_users', 'users', {
      page,
      limit,
      search_query: search ? 'provided' : 'none'
    });

    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Build query with search functionality
    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, role, created_at, membership_tier', { count: 'exact' });
    
    // Add search filter if provided
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }
    
    // Add pagination
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    
    // Execute query
    const { data: users, error, count } = await query;
    
    if (error) {
      console.error('Database error when fetching users:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users from database' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Get user emails from auth.users table
    const userIds = users.map((user: any) => user.id);
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
      perPage: userIds.length,
      page: 1
    });
    
    // Merge profile data with email from auth
    const enrichedUsers = users.map((user: any) => {
      const authUser = authUsers?.users?.find((au: any) => au.id === user.id);
      return {
        ...user,
        email: authUser?.email || 'unknown',
        emailConfirmed: !!authUser?.email_confirmed_at
      };
    });
    
    return new Response(
      JSON.stringify({ 
        users: enrichedUsers, 
        total: count || enrichedUsers.length, 
        page, 
        limit,
        totalPages: count ? Math.ceil(count / limit) : 1
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in handleGetUsers:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch users' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleCreateUser(supabase: any, adminId: string, req: Request) {
  try {
    const body = await req.json();
    
    // Validate request parameters
    const validation = ParameterValidator.validateParameters(body, ParameterValidator.SCHEMAS.USER_CREATE);
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid parameters', details: validation.errors }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the user creation attempt
    await logAdminAction(supabase, adminId, 'create_user', 'users', {
      email: validation.sanitizedData.email
    });

    // Create user in auth system
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: validation.sanitizedData.email,
      email_confirm: true,
      user_metadata: {
        first_name: validation.sanitizedData.firstName,
        last_name: validation.sanitizedData.lastName
      },
      app_metadata: {
        role: validation.sanitizedData.role || 'user'
      }
    });

    if (authError) {
      console.error('Error creating user in auth system:', authError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user', details: authError.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create profile record
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        first_name: validation.sanitizedData.firstName,
        last_name: validation.sanitizedData.lastName,
        role: validation.sanitizedData.role || 'user'
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      
      // Attempt to clean up auth user if profile creation fails
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error('Failed to clean up auth user after profile creation error:', cleanupError);
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile', details: profileError.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log successful user creation
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_created',
      details: { 
        created_user_id: authData.user.id,
        role: validation.sanitizedData.role || 'user'
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User created successfully',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          firstName: validation.sanitizedData.firstName,
          lastName: validation.sanitizedData.lastName,
          role: validation.sanitizedData.role || 'user'
        }
      }), 
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in handleCreateUser:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create user' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleUpdateUser(supabase: any, adminId: string, req: Request) {
  try {
    const body = await req.json();
    
    // Validate request parameters
    const validation = ParameterValidator.validateParameters(body, ParameterValidator.SCHEMAS.USER_UPDATE);
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid parameters', details: validation.errors }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const userId = validation.sanitizedData.userId;
    
    // Check if user exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
      
    if (userCheckError || !existingUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the user update attempt
    await logAdminAction(supabase, adminId, 'update_user', 'users', {
      target_user_id: userId,
      updated_fields: Object.keys(validation.sanitizedData).filter(k => k !== 'userId')
    });

    // Prepare profile updates
    const profileUpdates: Record<string, any> = {};
    if (validation.sanitizedData.firstName) profileUpdates.first_name = validation.sanitizedData.firstName;
    if (validation.sanitizedData.lastName) profileUpdates.last_name = validation.sanitizedData.lastName;
    if (validation.sanitizedData.role) profileUpdates.role = validation.sanitizedData.role;

    // Update profile if there are changes
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (profileUpdateError) {
        console.error('Error updating user profile:', profileUpdateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update user profile', details: profileUpdateError.message }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Update email if provided
    if (validation.sanitizedData.email) {
      const { error: emailUpdateError } = await supabase.auth.admin.updateUserById(
        userId,
        { email: validation.sanitizedData.email }
      );

      if (emailUpdateError) {
        console.error('Error updating user email:', emailUpdateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update user email', details: emailUpdateError.message }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Log successful user update
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_updated',
      details: { 
        target_user_id: userId,
        updated_fields: Object.keys(validation.sanitizedData).filter(k => k !== 'userId')
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User updated successfully',
        updatedFields: Object.keys(validation.sanitizedData).filter(k => k !== 'userId')
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in handleUpdateUser:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update user' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleDeleteUser(supabase: any, adminId: string, req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId || !ParameterValidator.isValidUUID(userId)) {
      return new Response(
        JSON.stringify({ error: 'Valid user ID required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if user exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();
      
    if (userCheckError || !existingUser) {
      return new Response(
        JSON.stringify({ error: 'User not found' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prevent deleting other admins as a safety measure
    if (existingUser.role === 'admin' && adminId !== userId) {
      // Log the attempt to delete another admin
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'admin_deletion_attempt',
        details: { 
          target_admin_id: userId,
          severity: 'high'
        }
      });
      
      return new Response(
        JSON.stringify({ error: 'Cannot delete another administrator' }), 
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the user deletion attempt (critical action)
    await logAdminAction(supabase, adminId, 'delete_user', 'users', {
      target_user_id: userId,
      severity: 'critical'
    });

    // Additional security check for user deletion
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'critical_user_deletion_attempt',
      details: { target_user_id: userId },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown'
    });

    // Delete user from auth system
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('Error deleting user from auth system:', authDeleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user', details: authDeleteError.message }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log successful user deletion
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_deleted',
      details: { target_user_id: userId }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User deleted successfully'
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in handleDeleteUser:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete user' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
