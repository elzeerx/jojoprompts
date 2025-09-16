
import { corsHeaders } from "../../_shared/standardImports.ts";
import { ParameterValidator } from "../../shared/parameterValidator.ts";
import { logAdminAction, logSecurityEvent } from "../../shared/securityLogger.ts";

export async function handleUpdateUser(supabase: any, adminId: string, req: Request) {
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
    if (validation.sanitizedData.role !== undefined) {
      profileUpdates.role = validation.sanitizedData.role;
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
    if (validation.sanitizedData.socialLinks !== undefined) {
      // Validate social links structure
      try {
        const socialLinks = typeof validation.sanitizedData.socialLinks === 'string' 
          ? JSON.parse(validation.sanitizedData.socialLinks)
          : validation.sanitizedData.socialLinks;
          
        if (socialLinks && typeof socialLinks === 'object') {
          profileUpdates.social_links = socialLinks;
        }
      } catch (error) {
        return new Response(
          JSON.stringify({ 
            error: 'Social links validation failed', 
            details: ['Invalid social links format'] 
          }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Update profile if there are changes
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (profileUpdateError) {
        console.error('Error updating user profile:', profileUpdateError);
        
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
    }

    // Update email if provided
    if (validation.sanitizedData.email) {
      const { error: emailUpdateError } = await supabase.auth.admin.updateUserById(
        userId,
        { email: validation.sanitizedData.email }
      );

      if (emailUpdateError) {
        console.error('Error updating user email:', emailUpdateError);
        
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
