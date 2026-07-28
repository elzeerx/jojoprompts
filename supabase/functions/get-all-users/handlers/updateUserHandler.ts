import { createEdgeLogger } from '../../_shared/logger.ts';
// Enhanced updateUserHandler with comprehensive audit logging
import {
  createClient,
  corsHeaders,
} from "../../_shared/standardImports.ts";
import { ParameterValidator } from "../../shared/parameterValidator.ts";
import { logAdminAction, logSecurityEvent } from "../../shared/securityLogger.ts";

const logger = createEdgeLogger('get-all-users:update-user');

type AdminClient = ReturnType<typeof createClient>;

function jsonError(
  error: string,
  status: number,
  details?: unknown,
): Response {
  return new Response(
    JSON.stringify({ error, ...(details === undefined ? {} : { details }) }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

export async function handleUpdateUser(
  supabase: AdminClient,
  adminId: string,
  actorRole: string,
  req: Request,
  parsedBody?: unknown,
) {
  try {
    // Use pre-parsed body if provided, otherwise parse from request
    const parsed = parsedBody ?? await req.json();
    const body =
      parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    const validationBody = { ...body };
    delete validationBody.action;
    
    // Get client information for audit logging
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    // Validate request parameters
    const validation = ParameterValidator.validateParameters(
      validationBody,
      ParameterValidator.SCHEMAS.USER_UPDATE,
    );
    if (!validation.isValid) {
      return jsonError('Invalid parameters', 400, validation.errors);
    }

    const userId = validation.sanitizedData.userId;
    const requestedFields = Object.keys(validation.sanitizedData)
      .filter((field) => field !== "userId");

    if (requestedFields.length === 0) {
      return jsonError("No user changes were provided", 400);
    }

    if (actorRole !== "admin") {
      return jsonError("Admin role required to update users", 403);
    }

    const sensitiveFields = [
      "email",
      "password",
      "role",
      "accountStatus",
      "emailConfirmed",
      "membershipTier",
    ];
    const requestsSensitiveChange = sensitiveFields.some(
      (field) => validation.sanitizedData[field] !== undefined,
    );

    if (validation.sanitizedData.membershipTier !== undefined) {
      return jsonError(
        "Legacy membership tiers cannot be changed in V2. Manage access through entitlements.",
        400,
      );
    }

    if (validation.sanitizedData.emailConfirmed === false) {
      return jsonError(
        "Removing email confirmation is not supported.",
        400,
      );
    }

    const [
      { data: actorAdminRole, error: actorRoleError },
      { data: targetAdminRole, error: targetRoleError },
    ] = await Promise.all([
      supabase
        .from("user_roles")
        .select("is_super_admin")
        .eq("user_id", adminId)
        .eq("role", "admin")
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("is_super_admin")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    if (actorRoleError || targetRoleError) {
      logger.error("Failed to verify user-update authority", {
        actorRoleError: actorRoleError?.message,
        targetRoleError: targetRoleError?.message,
      });
      return jsonError("Unable to verify update permission", 500);
    }

    const actorIsSuperAdmin = actorAdminRole?.is_super_admin === true;
    const targetIsSuperAdmin = targetAdminRole?.is_super_admin === true;

    if (targetIsSuperAdmin && !actorIsSuperAdmin) {
      return jsonError("Super admin required to update this account", 403);
    }

    if (requestsSensitiveChange && !actorIsSuperAdmin) {
      return jsonError(
        "Super admin required for role, email, password, verification, or account-status changes",
        403,
      );
    }
    
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
      updated_fields: requestedFields,
    });

    // Prepare profile updates with comprehensive field mapping
    const profileUpdates: Record<string, unknown> = {};
    
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
    if (validation.sanitizedData.socialLinks !== undefined) {
      profileUpdates.social_links = validation.sanitizedData.socialLinks;
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
        { ban_duration: isEnabled ? "none" : "876000h" },
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
    if (validation.sanitizedData.emailConfirmed === true) {
      const { error: confirmationError } = await supabase.auth.admin.updateUserById(
        userId,
        { email_confirm: true },
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


    // Update Auth first and then keep the profile email aligned. If the
    // profile update fails, restore the original Auth email as compensation.
    if (validation.sanitizedData.email) {
      const { data: existingAuthData, error: existingAuthError } =
        await supabase.auth.admin.getUserById(userId);

      if (existingAuthError || !existingAuthData.user) {
        logger.error("Unable to snapshot user before email update", {
          error: existingAuthError?.message,
          targetUserId: userId,
        });
        return jsonError("Unable to prepare user email update", 400);
      }

      const previousAuthEmail = existingAuthData.user.email;
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

      const { error: profileEmailError } = await supabase
        .from("profiles")
        .update({ email: validation.sanitizedData.email })
        .eq("id", userId);

      if (profileEmailError) {
        if (previousAuthEmail) {
          const { error: compensationError } =
            await supabase.auth.admin.updateUserById(
              userId,
              { email: previousAuthEmail },
            );

          if (compensationError) {
            logger.error("Email-update compensation failed", {
              error: compensationError.message,
              targetUserId: userId,
            });
          }
        }

        logger.error("Profile email update failed", {
          error: profileEmailError.message,
          targetUserId: userId,
        });
        return jsonError(
          "Failed to keep the profile email synchronized",
          400,
        );
      }
    }

    // Update password if provided (admin password change)
    if (validation.sanitizedData.password) {
      logger.info('Admin changing user password', { adminId, targetUserId: userId });
      
      const { error: passwordUpdateError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: validation.sanitizedData.password }
      );

      if (passwordUpdateError) {
        logger.error('Error updating user password', { error: passwordUpdateError.message });
        
        // Log security event for failed password change attempt
        await logSecurityEvent(supabase, {
          user_id: adminId,
          action: 'admin_password_change_failed',
          details: { 
            target_user_id: userId,
            error: passwordUpdateError.message
          }
        });
        
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update password', 
            details: passwordUpdateError.message
          }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Log successful password change for audit trail
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'admin_password_change_success',
        details: { 
          target_user_id: userId,
          changed_at: new Date().toISOString()
        }
      });
      
      logger.info('Password changed successfully by admin', { adminId, targetUserId: userId });
    }

    // Apply authorization changes last. This database function serializes the
    // replacement, verifies the actor's super-admin flag, preserves that flag
    // only for an admin role, and protects the final super admin.
    if (validation.sanitizedData.role !== undefined) {
      const { error: roleUpdateError } = await supabase.rpc(
        "admin_set_user_role_v2",
        {
          p_actor_id: adminId,
          p_target_user_id: userId,
          p_role: validation.sanitizedData.role,
        },
      );

      if (roleUpdateError) {
        logger.error("Atomic role update failed", {
          targetUserId: userId,
          error: roleUpdateError.message,
        });
        return jsonError(
          "Failed to update user role",
          roleUpdateError.message.includes("last_super_admin")
            ? 409
            : 400,
          roleUpdateError.message,
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
    
  } catch (error: unknown) {
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
