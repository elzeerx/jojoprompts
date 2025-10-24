import { createEdgeLogger } from '../../_shared/logger.ts';
// Enhanced updateUserHandler with comprehensive audit logging
import { corsHeaders } from "../../_shared/standardImports.ts";
import { ParameterValidator } from "../../shared/parameterValidator.ts";
import { logAdminAction, logSecurityEvent } from "../../shared/securityLogger.ts";

const logger = createEdgeLogger('get-all-users:update-user');

export async function handleUpdateUser(supabase: any, adminId: string, req: Request) {
  try {
    const body = await req.json();
    
    // Get client information for audit logging
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
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
    
    // Get existing user data for comparison and audit logging
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('*')
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

    // Prepare profile updates with comprehensive field mapping
    const profileUpdates: Record<string, any> = {};
    
    // Basic profile fields
    if (validation.sanitizedData.firstName !== undefined) {
      profileUpdates.first_name = validation.sanitizedData.firstName;
    }
    if (validation.sanitizedData.lastName !== undefined) {
      profileUpdates.last_name = validation.sanitizedData.lastName;
    }
    if (validation.sanitizedData.username !== undefined) {
      // Check username uniqueness before updating
      const { data: existingUsername } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', validation.sanitizedData.username)
        .neq('id', userId)
        .maybeSingle();
        
      if (existingUsername) {
        return new Response(
          JSON.stringify({ 
            error: 'Username validation failed', 
            details: ['Username already exists'] 
          }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      profileUpdates.username = validation.sanitizedData.username;
    }
    // Role updates are handled separately via user_roles table
    if (validation.sanitizedData.role !== undefined) {
      // Update role in user_roles table
      const newRole = validation.sanitizedData.role;
      
      // Delete existing roles for this user
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      // Insert new role
      await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: newRole,
          assigned_by: adminId,
          assigned_at: new Date().toISOString()
        });
    }
    
    // Extended profile fields
    if (validation.sanitizedData.bio !== undefined) {
      profileUpdates.bio = validation.sanitizedData.bio;
    }
    if (validation.sanitizedData.avatarUrl !== undefined) {
      profileUpdates.avatar_url = validation.sanitizedData.avatarUrl;
    }
    if (validation.sanitizedData.country !== undefined) {
      profileUpdates.country = validation.sanitizedData.country;
    }
    if (validation.sanitizedData.phoneNumber !== undefined) {
      profileUpdates.phone_number = validation.sanitizedData.phoneNumber;
    }
    if (validation.sanitizedData.timezone !== undefined) {
      profileUpdates.timezone = validation.sanitizedData.timezone;
    }
    if (validation.sanitizedData.membershipTier !== undefined) {
      profileUpdates.membership_tier = validation.sanitizedData.membershipTier;
    }
    
    // Update profile if there are changes with detailed audit logging
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (profileUpdateError) {
        logger.error('Error updating user profile', { error: profileUpdateError });
        
        // Provide specific error messages for common profile update failures
        let errorMessage = 'Failed to update user profile';
        let errorDetails = profileUpdateError.message;
        
        if (profileUpdateError.code === '23505') {
          // Unique constraint violation
          if (profileUpdateError.message.includes('username')) {
            errorMessage = 'Username validation failed';
            errorDetails = 'Username already exists';
          }
        } else if (profileUpdateError.code === '23514') {
          // Check constraint violation
          errorMessage = 'Profile validation failed';
          errorDetails = 'One or more profile fields contain invalid values';
        }
        
        return new Response(
          JSON.stringify({ 
            error: errorMessage, 
            details: errorDetails,
            field_errors: profileUpdateError.details ? [profileUpdateError.details] : []
          }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Log each individual field change for detailed audit trail
      for (const [fieldName, newValue] of Object.entries(profileUpdates)) {
        const oldValue = existingUser[fieldName];
        
        // Only log if value actually changed
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          try {
            await supabase.rpc('log_user_profile_change', {
              target_user_id: userId,
              admin_id: adminId,
              action_type: 'profile_field_update',
              field_name: fieldName,
              old_val: oldValue ? JSON.stringify(oldValue) : null,
              new_val: JSON.stringify(newValue),
              additional_metadata: JSON.stringify({
                admin_action: true,
                field_type: typeof newValue,
                change_timestamp: new Date().toISOString()
              }),
              client_ip: clientIp,
              client_user_agent: userAgent
            });
          } catch (auditError) {
            logger.error('Failed to log profile change', { error: auditError });
            // Don't fail the main operation if audit logging fails
          }
        }
      }
    }

    // Handle account status changes (enable/disable account)
    if (validation.sanitizedData.accountStatus !== undefined) {
      const isEnabled = validation.sanitizedData.accountStatus === 'enabled';
      
      const { error: statusUpdateError } = await supabase.auth.admin.updateUserById(
        userId,
        { 
          user_metadata: { account_disabled: !isEnabled },
          app_metadata: { account_disabled: !isEnabled }
        }
      );

      if (statusUpdateError) {
        logger.error('Error updating account status', { error: statusUpdateError });
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update account status', 
            details: statusUpdateError.message
          }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Handle email confirmation status
    if (validation.sanitizedData.emailConfirmed !== undefined) {
      const { error: confirmationError } = await supabase.auth.admin.updateUserById(
        userId,
        { 
          email_confirmed_at: validation.sanitizedData.emailConfirmed 
            ? new Date().toISOString() 
            : null
        }
      );

      if (confirmationError) {
        logger.error('Error updating email confirmation', { error: confirmationError });
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update email confirmation status', 
            details: confirmationError.message
          }), 
          { 
            status: 400, 
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
        logger.error('Error updating user email', { error: emailUpdateError });
        
        // Provide specific error messages for email update failures
        let errorMessage = 'Failed to update user email';
        let errorDetails = emailUpdateError.message;
        
        if (emailUpdateError.message.includes('duplicate') || emailUpdateError.message.includes('already exists')) {
          errorMessage = 'Email validation failed';
          errorDetails = 'Email address already in use';
        } else if (emailUpdateError.message.includes('invalid') || emailUpdateError.message.includes('format')) {
          errorMessage = 'Email validation failed';
          errorDetails = 'Invalid email format';
        }
        
        return new Response(
          JSON.stringify({ 
            error: errorMessage, 
            details: errorDetails,
            field_errors: ['email']
          }), 
          { 
            status: 400, 
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
    logger.error('Error in handleUpdateUser', { error });
    return new Response(
      JSON.stringify({ error: 'Failed to update user' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
