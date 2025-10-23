import { createEdgeLogger } from '../../_shared/logger.ts';
import { corsHeaders } from "../../_shared/standardImports.ts";
import { ParameterValidator } from "../../shared/parameterValidator.ts";
import { logAdminAction, logSecurityEvent } from "../../shared/securityLogger.ts";

const logger = createEdgeLogger('get-all-users:bulk-operations');

export async function handleBulkOperations(supabase: any, adminId: string, req: Request) {
  try {
    const body = await req.json();
    const { operation, userIds, updateData, exportOptions } = body;

    if (!operation || !userIds || !Array.isArray(userIds)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: operation and userIds are required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log bulk operation start
    const operationId = crypto.randomUUID();
    await logAdminAction(supabase, adminId, `bulk_${operation}_start`, 'bulk_operations', {
      operation_id: operationId,
      user_count: userIds.length,
      target_user_ids: userIds.slice(0, 10) // Log first 10 IDs for reference
    });

    let result;
    switch (operation) {
      case 'update':
        result = await handleBulkUpdate(supabase, adminId, userIds, updateData, operationId);
        break;
      case 'delete':
        result = await handleBulkDelete(supabase, adminId, userIds, operationId);
        break;
      case 'export':
        result = await handleBulkExport(supabase, adminId, userIds, exportOptions, operationId);
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid operation type' }), 
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

    // Log completion
    await logAdminAction(supabase, adminId, `bulk_${operation}_complete`, 'bulk_operations', {
      operation_id: operationId,
      success_count: result.successCount,
      error_count: result.errorCount,
      errors: result.errors
    });

    return new Response(
      JSON.stringify(result), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    logger.error('Error in bulk operations', { error });
    return new Response(
      JSON.stringify({ error: 'Internal server error during bulk operation' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleBulkUpdate(
  supabase: any, 
  adminId: string, 
  userIds: string[], 
  updateData: any,
  operationId: string
) {
  const results = {
    successCount: 0,
    errorCount: 0,
    errors: [] as string[]
  };

  for (const userId of userIds) {
    try {
      // Get original data for audit logging
      const { data: originalUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Prepare profile updates
      const profileUpdates: Record<string, any> = {};
      
      if (updateData.role !== undefined) {
        profileUpdates.role = updateData.role;
      }
      if (updateData.membership_tier !== undefined) {
        profileUpdates.membership_tier = updateData.membership_tier;
      }

      // Update profile
      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId);

        if (profileError) {
          throw profileError;
        }

        // Log each field change
        for (const [field, newValue] of Object.entries(profileUpdates)) {
          await supabase.rpc('log_user_profile_change', {
            target_user_id: userId,
            admin_id: adminId,
            action_type: 'bulk_profile_update',
            field_name: field,
            old_val: originalUser ? JSON.stringify(originalUser[field]) : null,
            new_val: JSON.stringify(newValue),
            additional_metadata: JSON.stringify({ operation_id: operationId, bulk_operation: true })
          }).catch(() => {}); // Don't fail bulk operation if logging fails
        }
      }

      // Handle account status changes
      if (updateData.account_status !== undefined) {
        const isEnabled = updateData.account_status === 'enabled';
        
        const { error: statusError } = await supabase.auth.admin.updateUserById(
          userId,
          { 
            user_metadata: { account_disabled: !isEnabled },
            app_metadata: { account_disabled: !isEnabled }
          }
        );

        if (statusError) {
          throw statusError;
        }

        await supabase.rpc('log_user_profile_change', {
          target_user_id: userId,
          admin_id: adminId,
          action_type: 'bulk_account_status_change',
          field_name: 'account_status',
          old_val: JSON.stringify(!isEnabled),
          new_val: JSON.stringify(isEnabled),
          additional_metadata: JSON.stringify({ operation_id: operationId, bulk_operation: true })
        }).catch(() => {});
      }

      results.successCount++;
    } catch (error: any) {
      logger.error('Bulk update error for user', { userId, error: error.message });
      results.errorCount++;
      results.errors.push(`User ${userId}: ${error.message || 'Unknown error'}`);
    }
  }

  return results;
}

async function handleBulkDelete(
  supabase: any, 
  adminId: string, 
  userIds: string[],
  operationId: string
) {
  const results = {
    successCount: 0,
    errorCount: 0,
    errors: [] as string[]
  };

  for (const userId of userIds) {
    try {
      // Use the existing admin delete function
      const { data: deleteResult } = await supabase.rpc('admin_delete_user_data', {
        target_user_id: userId
      });

      if (deleteResult?.success) {
        results.successCount++;
        
        // Log the deletion
        await supabase.rpc('log_user_profile_change', {
          target_user_id: userId,
          admin_id: adminId,
          action_type: 'bulk_user_deletion',
          field_name: null,
          old_val: null,
          new_val: null,
          additional_metadata: JSON.stringify({ operation_id: operationId, bulk_operation: true })
        }).catch(() => {});
      } else {
        throw new Error(deleteResult?.error || 'Unknown deletion error');
      }
    } catch (error: any) {
      logger.error('Bulk delete error for user', { userId, error: error.message });
      results.errorCount++;
      results.errors.push(`User ${userId}: ${error.message || 'Unknown error'}`);
    }
  }

  return results;
}

async function handleBulkExport(
  supabase: any, 
  adminId: string, 
  userIds: string[], 
  exportOptions: any,
  operationId: string
) {
  try {
    // Get user data for export
    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        username,
        role,
        email,
        membership_tier,
        country,
        phone_number,
        bio,
        avatar_url,
        created_at,
        updated_at,
        social_links,
        timezone
      `)
      .in('id', userIds);

    if (error) {
      throw error;
    }

    // Filter fields based on export options
    const fieldsToInclude = exportOptions?.fields || [
      'first_name', 'last_name', 'username', 'email', 'role'
    ];

    const exportData = users.map((user: any) => {
      const filtered: Record<string, any> = {};
      fieldsToInclude.forEach((field: string) => {
        if (user[field] !== undefined) {
          filtered[field] = user[field];
        }
      });
      return filtered;
    });

    // Log the export
    await supabase.rpc('log_user_profile_change', {
      target_user_id: null,
      admin_id: adminId,
      action_type: 'bulk_data_export',
      field_name: null,
      old_val: null,
      new_val: JSON.stringify({ user_count: userIds.length, fields: fieldsToInclude }),
      additional_metadata: JSON.stringify({ operation_id: operationId, bulk_operation: true })
    }).catch(() => {});

    return {
      successCount: exportData.length,
      errorCount: 0,
      errors: [],
      exportData,
      format: exportOptions?.format || 'json'
    };

  } catch (error: any) {
    logger.error('Bulk export error', { error: error.message });
    return {
      successCount: 0,
      errorCount: userIds.length,
      errors: [`Export failed: ${error.message || 'Unknown error'}`],
      exportData: null
    };
  }
}