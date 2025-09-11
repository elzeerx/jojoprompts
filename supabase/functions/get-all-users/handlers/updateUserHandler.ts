
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
