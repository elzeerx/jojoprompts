
import { corsHeaders } from "../../_shared/standardImports.ts";
import { logSecurityEvent } from "../../_shared/adminAuth.ts";

export async function handleUpdateUser(supabase: any, adminId: string, requestBody: any) {
  try {
    const { userId, updates } = requestBody;

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

    // Validate updates object
    if (!updates || typeof updates !== 'object') {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid updates format', 
          details: 'updates object is required'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if target user exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name')
      .eq('id', userId)
      .maybeSingle();
      
    if (userCheckError || !existingUser) {
      console.error(`[updateUserHandler] User ${userId} not found:`, userCheckError);
      return new Response(
        JSON.stringify({ 
          error: 'User not found', 
          details: userCheckError?.message || 'User does not exist'
        }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prevent modifying other admins as a safety measure
    if (existingUser.role === 'admin' && adminId !== userId && updates.role) {
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'admin_modification_attempt',
        details: { 
          target_admin_id: userId,
          attempted_changes: updates,
          severity: 'high'
        }
      });
      
      return new Response(
        JSON.stringify({ error: 'Cannot modify another administrator\'s role' }), 
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build updates object for profiles table
    const profileUpdates: any = {};
    const allowedFields = ['first_name', 'last_name', 'role', 'username', 'bio', 'country', 'phone_number'];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        profileUpdates[field] = updates[field];
      }
    }

    // Add updated_at timestamp if we have updates
    if (Object.keys(profileUpdates).length > 0) {
      profileUpdates.updated_at = new Date().toISOString();
    }

    let authUpdates: any = null;

    // Handle auth-level updates (email, password)
    if (updates.email || updates.password) {
      authUpdates = {};
      if (updates.email) {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updates.email)) {
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
        authUpdates.email = updates.email;
      }
      
      if (updates.password) {
        // Validate password
        if (updates.password.length < 6) {
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
        authUpdates.password = updates.password;
      }
    }

    // Log the update attempt
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_update_attempt',
      details: { 
        target_user_id: userId,
        target_user_name: `${existingUser.first_name} ${existingUser.last_name}`,
        profile_updates: profileUpdates,
        auth_updates: authUpdates ? Object.keys(authUpdates) : null
      }
    });

    console.log(`[updateUserHandler] Admin ${adminId} updating user: ${userId}`);

    let updatedProfile = null;
    let authUpdateResult = null;

    // Update auth data if needed
    if (authUpdates && Object.keys(authUpdates).length > 0) {
      const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(
        userId,
        authUpdates
      );

      if (authError) {
        console.error('Error updating user auth data:', authError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update user authentication data', 
            details: authError.message 
          }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      authUpdateResult = authData;
    }

    // Update profile data if needed
    if (Object.keys(profileUpdates).length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId)
        .select()
        .single();

      if (profileError) {
        console.error('Error updating user profile:', profileError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update user profile', 
            details: profileError.message 
          }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      updatedProfile = profileData;
    }

    // Log successful user update
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_update_success',
      details: { 
        updated_user_id: userId,
        updated_user_name: `${existingUser.first_name} ${existingUser.last_name}`,
        changes_applied: {
          profile: Object.keys(profileUpdates),
          auth: authUpdates ? Object.keys(authUpdates) : []
        }
      }
    });

    console.log(`[updateUserHandler] Successfully updated user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User updated successfully',
        user: {
          id: userId,
          profile: updatedProfile || existingUser,
          auth: authUpdateResult?.user || null
        }
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error('Error in handleUpdateUser:', error);
    
    // Log the error
    try {
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'user_update_error',
        details: { 
          error: error.message,
          target_user_id: requestBody.userId
        }
      });
    } catch (logError) {
      console.warn('Failed to log user update error:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update user',
        message: error.message || 'An unexpected error occurred'
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
