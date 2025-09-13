import { corsHeaders } from "../../_shared/standardImports.ts";
import { logSecurityEvent } from "../../_shared/adminAuth.ts";

export async function handleBulkUserOperations(supabase: any, adminId: string, requestBody: any) {
  try {
    const { operation, userIds, updates } = requestBody;

    // Validate operation
    const validOperations = ['bulk-delete', 'bulk-update', 'bulk-role-change'];
    if (!validOperations.includes(operation)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid bulk operation', 
          details: `Supported operations: ${validOperations.join(', ')}`
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate userIds
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid user IDs', 
          details: 'userIds must be a non-empty array'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Limit bulk operations for safety
    if (userIds.length > 100) {
      return new Response(
        JSON.stringify({ 
          error: 'Too many users selected', 
          details: 'Maximum 100 users can be processed in a single bulk operation'
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get user information for validation
    const { data: targetUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching target users:', usersError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch target users', 
          details: usersError.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Security check: prevent bulk operations on admins
    const adminUsers = targetUsers?.filter(user => user.role === 'admin') || [];
    if (adminUsers.length > 0 && operation === 'bulk-delete') {
      await logSecurityEvent(supabase, {
        user_id: adminId,
        action: 'bulk_admin_deletion_attempt',
        details: { 
          admin_targets: adminUsers.map(u => u.id),
          severity: 'critical'
        }
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Cannot bulk delete administrators', 
          details: `${adminUsers.length} admin users cannot be deleted`
        }), 
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log bulk operation attempt
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'bulk_operation_attempt',
      details: { 
        operation,
        target_count: userIds.length,
        target_user_ids: userIds,
        updates: updates || null
      }
    });

    console.log(`[bulkUserHandler] Admin ${adminId} performing ${operation} on ${userIds.length} users`);

    const results = [];
    const errors = [];

    // Process each user
    for (const userId of userIds) {
      try {
        let result = null;

        switch (operation) {
          case 'bulk-delete':
            result = await processBulkDelete(supabase, userId, adminId);
            break;
          case 'bulk-update':
            result = await processBulkUpdate(supabase, userId, updates);
            break;
          case 'bulk-role-change':
            result = await processBulkRoleChange(supabase, userId, updates.role);
            break;
        }

        if (result.success) {
          results.push({ userId, success: true, message: result.message });
        } else {
          errors.push({ userId, error: result.error });
        }
      } catch (error: any) {
        errors.push({ userId, error: error.message });
      }
    }

    // Log bulk operation completion
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'bulk_operation_complete',
      details: { 
        operation,
        total_processed: userIds.length,
        successful: results.length,
        failed: errors.length,
        errors: errors
      }
    });

    console.log(`[bulkUserHandler] Bulk operation completed: ${results.length} successful, ${errors.length} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Bulk operation completed`,
        summary: {
          total: userIds.length,
          successful: results.length,
          failed: errors.length
        },
        results,
        errors
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error('Error in handleBulkUserOperations:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process bulk operation',
        message: error.message || 'An unexpected error occurred'
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function processBulkDelete(supabase: any, userId: string, adminId: string) {
  try {
    // Use the admin_delete_user_data RPC
    const { data: deleteResult, error: deleteError } = await supabase.rpc('admin_delete_user_data', {
      target_user_id: userId
    });

    if (deleteError || !deleteResult?.success) {
      return { success: false, error: deleteError?.message || deleteResult?.error || 'Delete failed' };
    }

    // Delete user from auth
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    
    if (authDeleteError) {
      return { success: false, error: `Auth deletion failed: ${authDeleteError.message}` };
    }

    return { success: true, message: 'User deleted successfully' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function processBulkUpdate(supabase: any, userId: string, updates: any) {
  try {
    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (profileError) {
      return { success: false, error: `Profile update failed: ${profileError.message}` };
    }

    return { success: true, message: 'User updated successfully' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function processBulkRoleChange(supabase: any, userId: string, newRole: string) {
  try {
    // Validate role
    const validRoles = ['user', 'admin', 'jadmin', 'prompter'];
    if (!validRoles.includes(newRole)) {
      return { success: false, error: `Invalid role: ${newRole}` };
    }

    // Update role
    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (roleError) {
      return { success: false, error: `Role change failed: ${roleError.message}` };
    }

    return { success: true, message: `Role changed to ${newRole}` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}