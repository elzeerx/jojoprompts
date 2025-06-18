
import { corsHeaders } from "../cors.ts";
import { ParameterValidator } from "../../shared/parameterValidator.ts";
import { logAdminAction, logSecurityEvent } from "../../shared/securityLogger.ts";

export async function handleDeleteUser(supabase: any, adminId: string, req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId || !ParameterValidator.SCHEMAS.USER_UPDATE.userId) {
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
