
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

  try {
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
    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    console.error(`[userDeletion] Error when deleting user ${userId}:`, error);
    throw error;
  }
}
