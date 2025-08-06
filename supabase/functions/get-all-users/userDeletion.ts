
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { safeDelete, logStep } from './dbUtils.ts';

/**
 * Delete all user data in the correct order to avoid FK errors.
 * Throws descriptive errors if something goes wrong.
 */
export async function deleteUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  adminId: string
) {
  console.log(`[userDeletion] Admin ${adminId} is attempting to delete user ${userId}`);
  
  // Start transaction logging
  const transactionStart = Date.now();
  console.log(`[userDeletion] Transaction started for user ${userId} at ${new Date(transactionStart).toISOString()}`);

  try {
    // Enhanced validation before starting deletion
    const { data: userCheck } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name')
      .eq('id', userId)
      .single();
      
    if (!userCheck) {
      throw new Error(`User ${userId} not found during deletion validation`);
    }
    
    console.log(`[userDeletion] Validated user exists: ${userCheck.first_name} ${userCheck.last_name} (${userCheck.role})`);
    
    // Delete in order to respect foreign key constraints
    // 1. First delete all audit/logging tables that reference the user
    logStep('Deleting security logs', userId);
    await safeDelete(supabase, 'security_logs', 'user_id', userId);
    
    logStep('Deleting email logs', userId);
    await safeDelete(supabase, 'email_logs', 'user_id', userId);
    
    logStep('Deleting admin audit logs', userId);
    await safeDelete(supabase, 'admin_audit_log', 'admin_user_id', userId);

    // 2. Delete collection-related data (collection_prompts references collections)
    logStep('Deleting collection prompts', userId);
    const { data: userCollections } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', userId);
    
    if (userCollections && userCollections.length > 0) {
      for (const collection of userCollections) {
        await safeDelete(supabase, 'collection_prompts', 'collection_id', collection.id);
      }
    }
    
    logStep('Deleting collections', userId);
    await safeDelete(supabase, 'collections', 'user_id', userId);

    // 3. Delete other user-related data
    logStep('Deleting prompt shares', userId);
    await safeDelete(supabase, 'prompt_shares', 'shared_by', userId);
    
    logStep('Deleting prompt usage history', userId);
    await safeDelete(supabase, 'prompt_usage_history', 'user_id', userId);
    
    logStep('Deleting user subscriptions', userId);
    await safeDelete(supabase, 'user_subscriptions', 'user_id', userId);
    
    logStep('Deleting transactions', userId);
    await safeDelete(supabase, 'transactions', 'user_id', userId);
    
    logStep('Deleting favorites', userId);
    await safeDelete(supabase, 'favorites', 'user_id', userId);
    
    logStep('Deleting prompts', userId);
    await safeDelete(supabase, 'prompts', 'user_id', userId);
    
    logStep('Deleting discount code usage', userId);
    await safeDelete(supabase, 'discount_code_usage', 'user_id', userId);
    
    // Delete prompt generator templates created by user
    logStep('Deleting prompt generator templates', userId);
    await safeDelete(supabase, 'prompt_generator_templates', 'created_by', userId);
    
    // Delete prompt generator fields created by user  
    logStep('Deleting prompt generator fields', userId);
    await safeDelete(supabase, 'prompt_generator_fields', 'created_by', userId);
    
    // Delete prompt generator models created by user
    logStep('Deleting prompt generator models', userId);
    await safeDelete(supabase, 'prompt_generator_models', 'created_by', userId);
    
    // Delete discount codes created by user
    logStep('Deleting discount codes', userId);
    await safeDelete(supabase, 'discount_codes', 'created_by', userId);
    
    // 4. Delete profile last (but before auth user)
    logStep('Deleting profile', userId);
    await safeDelete(supabase, 'profiles', 'id', userId);

    // 5. Finally delete from auth.users
    logStep('Deleting user from Auth', userId);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error(`[userDeletion] Error deleting user ${userId} from Auth:`, deleteError);
      throw new Error(`Error deleting user from Auth: ${deleteError.message}`);
    }

    logStep('User deleted successfully', userId);
    
    // Log transaction completion
    const transactionEnd = Date.now();
    const duration = transactionEnd - transactionStart;
    console.log(`[userDeletion] Transaction completed successfully for user ${userId} in ${duration}ms`);
    
    return { 
      success: true, 
      message: 'User deleted successfully',
      transactionDuration: duration,
      deletedUserId: userId 
    };
  } catch (error) {
    const transactionEnd = Date.now();
    const duration = transactionEnd - transactionStart;
    
    console.error(`[userDeletion] Transaction failed for user ${userId} after ${duration}ms:`, {
      error: error.message,
      stack: error.stack?.substring(0, 300),
      adminId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    // Enhanced error with transaction context
    throw new Error(`User deletion failed after ${duration}ms: ${error.message}`);
  }
}
