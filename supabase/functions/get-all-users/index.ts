import { serve, corsHeaders, createSupabaseClient, createClient, handleCors } from "../_shared/standardImports.ts";
import { verifyAdmin, validateAdminRequest, hasPermission, logSecurityEvent } from "../_shared/adminAuth.ts";

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

          return await handleDeleteUser(supabase, userId, req);
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
        } else if (action === 'change-password') {
          // Verify super admin permissions (only nawaf@elzeer.com)
          const { data: adminProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', userId)
            .single();

          if (!adminProfile || adminProfile.email !== 'nawaf@elzeer.com') {
            await logSecurityEvent(supabase, {
              user_id: userId,
              action: 'unauthorized_password_change_attempt',
              details: { 
                attempted_by: adminProfile?.email || 'unknown',
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

          return await handleChangePassword(supabase, userId, requestBody);
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
    console.error('Critical error in get-all-users function:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString()
    });

    // Try to log the error if we have a supabase client
    try {      
      const supabase = createSupabaseClient();
      await logSecurityEvent(supabase, {
        action: 'function_error',
        details: { 
          function: 'get-all-users',
          error: error.message,
          method: req.method
        },
        ip_address: req.headers.get('x-forwarded-for') || 'unknown'
      });
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

// Simplified handleGetUsers function directly in this file
async function handleGetUsers(supabase: any, adminId: string, req: Request) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const search = url.searchParams.get('search') || '';
    
    console.log(`[${requestId}] Starting getUsersHandler - page: ${page}, limit: ${limit}, search: "${search}"`);
    
    // Enhanced validation
    if (page < 1 || limit < 1) {
      console.warn(`[${requestId}] Invalid pagination parameters: page=${page}, limit=${limit}`);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid pagination parameters',
          details: { page, limit }
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get all users from auth
    console.log(`[${requestId}] Fetching all users from auth`);
    let allUsers: any[] = [];
    let page_num = 1;
    let hasMore = true;
    const perPage = 1000;
    
    while (hasMore) {
      const { data: batchUsers, error: batchError } = await supabase.auth.admin.listUsers({
        perPage,
        page: page_num
      });
      
      if (batchError) {
        console.error(`[${requestId}] Error fetching user batch ${page_num}:`, batchError);
        throw new Error(`Failed to fetch users: ${batchError.message}`);
      }
      
      const batchUserList = batchUsers?.users || [];
      allUsers.push(...batchUserList);
      
      hasMore = batchUserList.length === perPage;
      page_num++;
      
      // Safety break to prevent infinite loops
      if (page_num > 50) {
        console.warn(`[${requestId}] Breaking pagination loop at page ${page_num} - potential infinite loop`);
        break;
      }
    }
    
    // Filter out users without profiles - only show users with corresponding profiles
    if (allUsers.length > 0) {
      const allUserIds = allUsers.map(user => user.id);
      const { data: existingProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .in('id', allUserIds);
      
      if (profileError) {
        console.error(`[${requestId}] Error fetching profiles for filtering:`, profileError);
        // If we can't fetch profiles, continue with all users to avoid breaking functionality
      } else {
        const existingProfileIds = new Set(existingProfiles?.map(p => p.id) || []);
        const originalCount = allUsers.length;
        allUsers = allUsers.filter(user => existingProfileIds.has(user.id));
        console.log(`[${requestId}] Filtered users: ${originalCount} -> ${allUsers.length} (removed ${originalCount - allUsers.length} users without profiles)`);
      }
    }
    
    const totalUsers = allUsers.length;
    
    // Apply search filter if provided
    let filteredUsers = allUsers;
    if (search) {
      filteredUsers = allUsers.filter((user: any) => {
        const email = user.email?.toLowerCase() || '';
        const searchLower = search.toLowerCase();
        return email.includes(searchLower);
      });
    }
    
    const totalFilteredUsers = filteredUsers.length;
    
    // Validation - ensure page doesn't exceed available pages
    const totalPages = Math.ceil(totalFilteredUsers / limit);
    if (page > totalPages && totalFilteredUsers > 0) {
      console.warn(`[${requestId}] Page ${page} exceeds available pages ${totalPages}, redirecting to last page`);
      const correctedPage = Math.max(1, totalPages);
      return new Response(
        JSON.stringify({ 
          error: 'Page exceeds available data',
          redirect: { page: correctedPage, totalPages },
          total: totalFilteredUsers,
          totalUsers
        }), 
        { 
          status: 416, // Range Not Satisfiable
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Apply pagination to filtered results
    const startIndex = (page - 1) * limit;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + limit);
    
    // Get user IDs from paginated results for profile enrichment
    const userIds = paginatedUsers.map((user: any) => user.id);
    
    // Enhanced profile fetching with error recovery
    let profiles = [];
    let subscriptions = [];
    if (userIds.length > 0) {
      try {
        // Fetch profiles
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, username, role, created_at')
          .in('id', userIds);
        
        if (profileError) {
          console.error(`[${requestId}] Database error when fetching profiles:`, profileError);
          profiles = [];
        } else {
          profiles = profilesData || [];
        }

        // Fetch active subscriptions with plan details
        const { data: subscriptionsData, error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .select(`
            user_id, 
            status,
            created_at,
            end_date,
            plan_id:subscription_plans(id, name, price_usd, is_lifetime)
          `)
          .in('user_id', userIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (subscriptionError) {
          console.error(`[${requestId}] Database error when fetching subscriptions:`, subscriptionError);
          subscriptions = [];
        } else {
          subscriptions = subscriptionsData || [];
        }
      } catch (fetchError) {
        console.error(`[${requestId}] Exception during profile/subscription fetch:`, fetchError);
        profiles = [];
        subscriptions = [];
      }
    }
    
    // Merge profile data and subscription data with auth data
    const enrichedUsers = paginatedUsers.map((authUser: any) => {
      const profile = profiles.find((p: any) => p.id === authUser.id);
      // Find the most recent active subscription for this user
      const userSubscriptions = subscriptions.filter((sub: any) => sub.user_id === authUser.id);
      const latestSubscription = userSubscriptions.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      return {
        id: authUser.id,
        email: authUser.email || 'unknown',
        emailConfirmed: !!authUser.email_confirmed_at,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        role: profile?.role || 'user',
        username: profile?.username || '',
        subscription: latestSubscription ? {
          plan_name: latestSubscription.plan_id?.name || 'Unknown',
          status: latestSubscription.status,
          end_date: latestSubscription.end_date,
          is_lifetime: latestSubscription.plan_id?.is_lifetime || false,
          price_usd: latestSubscription.plan_id?.price_usd || 0
        } : null
      };
    });
    
    // Calculate final pagination info
    const finalTotalPages = Math.ceil(totalFilteredUsers / limit);
    
    // Enhanced response with performance metadata
    const responseData = {
      users: enrichedUsers,
      total: totalFilteredUsers,
      totalUsers: totalUsers,
      page,
      limit,
      totalPages: finalTotalPages,
      performance: {
        requestId,
        totalDuration: Date.now() - startTime,
        searchActive: !!search
      }
    };
    
    console.log(`[${requestId}] Request completed successfully - returned ${enrichedUsers.length} users`);
    
    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    const errorDuration = Date.now() - startTime;
    console.error(`[${requestId}] Error in handleGetUsers (${errorDuration}ms):`, error);
    
    // Enhanced error response with more context
    const errorResponse = {
      error: 'Failed to fetch users',
      message: error.message || 'Unknown error occurred',
      requestId,
      timestamp: new Date().toISOString(),
      duration: errorDuration
    };
    
    return new Response(
      JSON.stringify(errorResponse), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Handle password change with proper authentication
async function handleChangePassword(supabase: any, adminId: string, requestBody: any) {
  try {
    const { userId, newPassword } = requestBody;

    // Validate userId parameter
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid user ID format', 
          details: 'userId is required and must be a string'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate password parameter
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid password', 
          details: 'Password must be at least 6 characters long'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if target user exists in auth system
    const { data: authUser, error: authCheckError } = await supabase.auth.admin.getUserById(userId);
    
    if (authCheckError || !authUser?.user) {
      console.error(`[changePasswordHandler] User ${userId} not found in auth:`, authCheckError);
      return new Response(
        JSON.stringify({ 
          error: 'User not found', 
          details: authCheckError?.message || 'User does not exist in authentication system'
        }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const targetUser = {
      id: authUser.user.id,
      email: authUser.user.email,
      first_name: authUser.user.user_metadata?.first_name || '',
      last_name: authUser.user.user_metadata?.last_name || ''
    };

    // Enhanced super admin check - only nawaf@elzeer.com can change passwords
    const { data: adminUser, error: adminUserError } = await supabase.auth.admin.getUserById(adminId);

    if (adminUserError || !adminUser.user) {
      console.error('[handleChangePassword] Failed to get admin user:', adminUserError);
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'password_change_admin_lookup_error',
        details: { error: adminUserError?.message, target_user_id: userId }
      });
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin credentials' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (adminUser.user.email !== 'nawaf@elzeer.com') {
      console.error(`[handleChangePassword] Unauthorized password change attempt by ${adminUser.user.email}`);
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'password_change_unauthorized_attempt',
        details: { admin_email: adminUser.user.email, target_user_id: userId }
      });
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions for password changes' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the password change attempt
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'password_change_attempt',
      details: { 
        target_user_id: userId,
        target_user_email: targetUser.email
      }
    });

    console.log(`[changePasswordHandler] Admin ${adminId} changing password for user ${userId} (${targetUser.email})`);

    // Update the user's password using Supabase Admin API
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { 
        password: newPassword,
        email_confirm: true // Ensure user remains confirmed
      }
    );

    if (updateError) {
      console.error('Error updating user password:', updateError);
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'password_change_failed',
        details: { 
          target_user_id: userId,
          error: updateError.message
        }
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to change password', 
          details: updateError.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log successful password change
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'password_change_success',
      details: { 
        target_user_id: userId,
        target_user_email: targetUser.email
      }
    });

    console.log(`[changePasswordHandler] Successfully changed password for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password changed successfully',
        user: {
          id: userId,
          email: targetUser.email,
          name: `${targetUser.first_name || ''} ${targetUser.last_name || ''}`.trim()
        }
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error('Error in handleChangePassword:', error);
    
    // Log the error
    try {
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'password_change_error',
        details: { 
          error: error.message,
          target_user_id: requestBody.userId
        }
      });
    } catch (logError) {
      console.warn('Failed to log password change error:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to change password',
        message: error.message || 'An unexpected error occurred'
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Handle user deletion with proper authentication
async function handleDeleteUser(supabase: any, adminId: string, req: Request) {
  try {
    // Parse request body
    const requestBody = await req.json();
    const { action, userId } = requestBody;

    // Validate the action is delete
    if (action !== 'delete') {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate userId parameter
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid user ID format', 
          details: 'userId is required and must be a string',
          received: userId 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if user exists BEFORE deletion
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name')
      .eq('id', userId)
      .maybeSingle();
      
    if (userCheckError || !existingUser) {
      console.error(`[deleteUserHandler] User ${userId} not found:`, userCheckError);
      return new Response(
        JSON.stringify({ 
          error: 'User not found', 
          details: userCheckError?.message || 'User does not exist in the database',
          userId: userId 
        }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[deleteUserHandler] Found user to delete: ${existingUser.first_name} ${existingUser.last_name} (${existingUser.role})`);

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

    // Extract Bearer token from the request for user-scoped operations
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }), 
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
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

    // Log the user deletion attempt (critical action)
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'critical_user_deletion_attempt',
      details: { 
        target_user_id: userId,
        target_user_name: `${existingUser.first_name} ${existingUser.last_name}`,
        target_user_role: existingUser.role
      }
    });

    const startTime = Date.now();
    console.log(`[deleteUserHandler] Starting deletion process for user ${userId} (${existingUser.first_name} ${existingUser.last_name}) by admin ${adminId}`);
    
    // Step 1: Delete user data using user-scoped client for RPC call
    const { data: deleteResult, error: deleteError } = await supabaseAsUser.rpc('admin_delete_user_data', {
      target_user_id: userId
    });

    if (deleteError || !deleteResult?.success) {
      console.error(`[deleteUserHandler] Failed to delete user data for ${userId}:`, deleteError || deleteResult);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete user data',
          details: deleteError?.message || deleteResult?.error || 'Unknown error',
          userId: userId
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 2: Delete user from Supabase Auth using service role client
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error(`[deleteUserHandler] Failed to delete user from auth ${userId}:`, authDeleteError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete user from authentication system',
          details: authDeleteError.message,
          userId: userId
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const transactionDuration = Date.now() - startTime;

    // Log successful user deletion with enhanced details
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_deleted',
      details: { 
        target_user_id: userId,
        target_user_email: `${existingUser.first_name} ${existingUser.last_name}`,
        transaction_duration: transactionDuration,
        success: true 
      }
    });

    console.log(`[deleteUserHandler] User ${userId} (${existingUser.first_name} ${existingUser.last_name}) successfully deleted by admin ${adminId} in ${transactionDuration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User deleted successfully',
        transactionDuration,
        deletedUser: {
          id: userId,
          name: `${existingUser.first_name} ${existingUser.last_name}`,
          role: existingUser.role
        }
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error(`[deleteUserHandler] Critical error deleting user:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete user', 
        details: error.message,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Handle user creation with proper authentication
async function handleCreateUser(supabase: any, adminId: string, requestBody: any) {
  try {
    const { userData } = requestBody;

    // Validate required fields
    if (!userData?.email || !userData?.password) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid user data', 
          details: 'email and password are required'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid email format', 
          details: 'Please provide a valid email address'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate password
    if (userData.password.length < 6) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid password', 
          details: 'Password must be at least 6 characters long'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log the user creation attempt
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_creation_attempt',
      details: { 
        target_email: userData.email,
        target_first_name: userData.first_name,
        target_last_name: userData.last_name
      }
    });

    console.log(`[createUserHandler] Admin ${adminId} creating user: ${userData.email}`);

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        first_name: userData.first_name || '',
        last_name: userData.last_name || ''
      }
    });

    if (authError) {
      console.error('Error creating user in auth system:', authError);
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'user_creation_failed',
        details: { 
          target_email: userData.email,
          error: authError.message
        }
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create user in authentication system', 
          details: authError.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!authData?.user?.id) {
      return new Response(
        JSON.stringify({ 
          error: 'User creation failed', 
          details: 'No user ID returned from authentication system'
        }), 
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
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        role: 'user'
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      
      // Clean up auth user if profile creation fails
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error('Failed to clean up auth user after profile creation error:', cleanupError);
      }
      
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'user_creation_failed',
        details: { 
          target_email: userData.email,
          error: 'Profile creation failed: ' + profileError.message
        }
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create user profile', 
          details: profileError.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log successful user creation
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_creation_success',
      details: { 
        created_user_id: authData.user.id,
        created_user_email: userData.email,
        created_user_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
      }
    });

    console.log(`[createUserHandler] Successfully created user ${authData.user.id} (${userData.email})`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User created successfully',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          role: 'user'
        }
      }), 
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error('Error in handleCreateUser:', error);
    
    // Log the error
    try {
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'user_creation_error',
        details: { 
          error: error.message,
          target_email: requestBody.userData?.email
        }
      });
    } catch (logError) {
      console.warn('Failed to log user creation error:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create user',
        message: error.message || 'An unexpected error occurred'
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}