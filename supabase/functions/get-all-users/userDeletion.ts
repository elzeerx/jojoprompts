
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
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
    
    // Use the new powerful database function that bypasses RLS
    logStep('Deleting all user data via database function', userId);
    const { data: deletionResult, error: deletionError } = await supabase
      .rpc('admin_delete_user_data', { target_user_id: userId });

    if (deletionError) {
      console.error(`[userDeletion] Database deletion failed:`, deletionError);
      throw new Error(`Database deletion failed: ${deletionError.message}`);
    }

    if (!deletionResult?.success) {
      console.error(`[userDeletion] Database deletion returned failure:`, deletionResult);
      throw new Error(`Database deletion failed: ${deletionResult?.error || 'Unknown error'}`);
    }

    console.log(`[userDeletion] Database deletion completed in ${deletionResult.duration_ms}ms`);

    // Finally delete from auth.users
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
