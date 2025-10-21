import { corsHeaders } from "../../_shared/standardImports.ts";
import { logAdminAction, logSecurityEvent } from "../../shared/securityLogger.ts";

/**
 * Create a new user with optional role assignment
 * Only super admin can create users with admin/jadmin roles
 */
export async function handleCreateUser(supabase: any, adminId: string, requestBody: any) {
  try {
    const { email, password, first_name, last_name, role = 'user' } = requestBody;
    const ipAddress = requestBody.ip_address || 'unknown';
    const userAgent = requestBody.user_agent || 'unknown';

    // Validate required fields
    if (!email || !password) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields', 
          details: 'Email and password are required'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if creating privileged role (admin/jadmin/prompter)
    if (['admin', 'jadmin', 'prompter'].includes(role)) {
      // Get admin's email from auth
      const { data: adminAuth } = await supabase.auth.admin.getUserById(adminId);
      const adminEmail = adminAuth?.user?.email;

      // Only super admin can create privileged users
      if (adminEmail !== 'nawaf@elzeer.com') {
        await logSecurityEvent(supabase, {
          user_id: adminId,
          action: 'unauthorized_privileged_user_creation_attempt',
          details: {
            attempted_role: role,
            admin_email: adminEmail || 'unknown',
            target_email: email
          }
        });

        return new Response(
          JSON.stringify({ 
            error: 'Only super admin can create users with privileged roles',
            details: `Cannot create ${role} users`
          }), 
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Log user creation attempt
    await logAdminAction(supabase, adminId, 'create_user', 'users', {
      target_email: email,
      role,
      ip_address: ipAddress,
      user_agent: userAgent
    }, ipAddress);

    // Create user in auth
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: {
        first_name: first_name || 'User',
        last_name: last_name || ''
      }
    });

    if (createError) {
      console.error('[createUserHandler] Failed to create user:', createError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create user', 
          details: createError.message
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create profile with specified role
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: newUser.user.id,
        first_name: first_name || 'User',
        last_name: last_name || '',
        username: email.split('@')[0],
        role
      });

    if (profileError) {
      console.error('[createUserHandler] Failed to create profile:', profileError);
      // If profile creation fails, delete the auth user
      await supabase.auth.admin.deleteUser(newUser.user.id);
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create user profile', 
          details: profileError.message
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log successful user creation
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_created',
      details: {
        new_user_id: newUser.user.id,
        email,
        role,
        created_by_admin: true
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User created successfully',
        user: {
          id: newUser.user.id,
          email,
          role
        }
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error('[createUserHandler] Critical error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create user', 
        details: error.message
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
