
import { corsHeaders } from "../../_shared/standardImports.ts";
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
      { userId: ParameterValidator.SCHEMAS.USER_DELETE.userId }
    );
    
    if (!validation.isValid) {
      console.error(`[deleteUserHandler] Validation failed for userId ${userId}:`, validation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid user ID format', 
          details: validation.errors.join(', '),
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

    // Enhanced logging before deletion
    console.log(`[deleteUserHandler] Starting deletion process for user ${userId} (${existingUser.first_name} ${existingUser.last_name}) by admin ${adminId}`);
    
    // Use the comprehensive deleteUser function from userDeletion.ts
    const deletionResult = await deleteUser(supabase, userId, adminId);

    // Log successful user deletion with enhanced details
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_deleted',
      details: { 
        target_user_id: userId,
        target_user_email: existingUser.first_name + ' ' + existingUser.last_name,
        transaction_duration: deletionResult.transactionDuration,
        success: true 
      }
    });

    console.log(`[deleteUserHandler] User ${userId} (${existingUser.first_name} ${existingUser.last_name}) successfully deleted by admin ${adminId} in ${deletionResult.transactionDuration}ms`);

    return new Response(
      JSON.stringify({
        ...deletionResult,
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
    console.error(`[deleteUserHandler] Critical error deleting user ${requestBody.userId}:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete user', 
        details: error.message,
        userId: requestBody.userId,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
