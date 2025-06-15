
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
    await safeDelete(supabase, 'collection_prompts', 'collection_id', userId);
    await safeDelete(supabase, 'collections', 'user_id', userId);
    await safeDelete(supabase, 'prompt_shares', 'shared_by', userId);
    await safeDelete(supabase, 'prompt_usage_history', 'user_id', userId);
    await safeDelete(supabase, 'user_subscriptions', 'user_id', userId);
    await safeDelete(supabase, 'transactions', 'user_id', userId);
    await safeDelete(supabase, 'favorites', 'user_id', userId);
    await safeDelete(supabase, 'prompts', 'user_id', userId);
    await safeDelete(supabase, 'discount_code_usage', 'user_id', userId);
    await safeDelete(supabase, 'profiles', 'id', userId);

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
