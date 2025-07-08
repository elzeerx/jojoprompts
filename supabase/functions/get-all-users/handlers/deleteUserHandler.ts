
import { corsHeaders } from "../cors.ts";
import { ParameterValidator } from "../../shared/parameterValidator.ts";
import { logAdminAction, logSecurityEvent } from "../../shared/securityLogger.ts";
import { deleteUser } from "../userDeletion.ts";

export async function handleDeleteUser(supabase: any, adminId: string, requestBody: any) {
  try {
    // Extract userId from the already-parsed request body
    const userId = requestBody.userId;
    
    // Validate userId parameter
    const validation = ParameterValidator.validateParameters(
      { userId },
      { userId: ParameterValidator.SCHEMAS.USER_UPDATE.userId }
    );
    
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({ error: validation.errors.join(', ') }), 
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

    // Additional security check for user deletion (without IP address)
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'critical_user_deletion_attempt',
      details: { target_user_id: userId }
    });

    // Use the comprehensive deleteUser function from userDeletion.ts
    const deletionResult = await deleteUser(supabase, userId, adminId);

    // Log successful user deletion
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_deleted',
      details: { target_user_id: userId }
    });

    return new Response(
      JSON.stringify(deletionResult), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Error in handleDeleteUser:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete user', details: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
