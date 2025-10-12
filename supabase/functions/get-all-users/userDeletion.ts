
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { safeDelete, logStep } from './dbUtils.ts';

/**
 * Enhanced error types for better error handling
 */
interface DeletionError {
  code: string;
  message: string;
  isRetryable: boolean;
  httpStatus: number;
}

/**
 * Categorize errors and determine if they're retryable
 */
function categorizeDeletionError(error: any): DeletionError {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  const errorCode = error?.code || error?.error_code || 'UNKNOWN';

  // FK constraint violations - not retryable
  if (errorMessage.includes('foreign key') || errorCode === 'FK_VIOLATION' || errorCode === '23503') {
    return {
      code: 'FK_VIOLATION',
      message: `Foreign key constraint violation: ${errorMessage}`,
      isRetryable: false,
      httpStatus: 409
    };
  }

  // User not found - not retryable
  if (errorMessage.includes('not found') || errorCode === 'USER_NOT_FOUND' || errorCode === 'PGRST116') {
    return {
      code: 'USER_NOT_FOUND',
      message: 'User not found',
      isRetryable: false,
      httpStatus: 404
    };
  }

  // Permission errors - not retryable
  if (errorMessage.includes('permission') || errorMessage.includes('unauthorized') || 
      errorCode === 'UNAUTHORIZED' || errorCode === '42501') {
    return {
      code: 'UNAUTHORIZED',
      message: 'Insufficient permissions',
      isRetryable: false,
      httpStatus: 403
    };
  }

  // Network/timeout errors - retryable
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || 
      errorMessage.includes('ECONNREFUSED') || errorCode === 'NETWORK_ERROR') {
    return {
      code: 'NETWORK_ERROR',
      message: `Network error: ${errorMessage}`,
      isRetryable: true,
      httpStatus: 503
    };
  }

  // Database errors - potentially retryable
  if (errorCode === 'DATABASE_ERROR' || errorCode.startsWith('P')) {
    return {
      code: 'DATABASE_ERROR',
      message: `Database error: ${errorMessage}`,
      isRetryable: true,
      httpStatus: 500
    };
  }

  // Default: unknown error, may be retryable
  return {
    code: 'UNKNOWN_ERROR',
    message: errorMessage,
    isRetryable: true,
    httpStatus: 500
  };
}

/**
 * Sleep function for retry delays
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Delete all user data with retry logic and enhanced error handling
 */
export async function deleteUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  adminId: string,
  maxRetries = 3
) {
  console.log(`[userDeletion] Admin ${adminId} is attempting to delete user ${userId}`);
  
  const transactionStart = Date.now();
  console.log(`[userDeletion] Transaction started for user ${userId} at ${new Date(transactionStart).toISOString()}`);

  let lastError: DeletionError | null = null;

  // Retry loop with exponential backoff
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[userDeletion] Deletion attempt ${attempt}/${maxRetries} for user ${userId}`);

      // Enhanced validation before starting deletion
      const { data: userCheck, error: userCheckError } = await supabase
        .from('profiles')
        .select('id, role, first_name, last_name, email')
        .eq('id', userId)
        .maybeSingle();
      
      if (userCheckError) {
        console.error(`[userDeletion] Error checking user existence:`, userCheckError);
        throw userCheckError;
      }
        
      if (!userCheck) {
        const notFoundError = new Error(`User ${userId} not found during deletion validation`);
        (notFoundError as any).code = 'USER_NOT_FOUND';
        throw notFoundError;
      }
      
      console.log(`[userDeletion] Validated user exists: ${userCheck.first_name} ${userCheck.last_name} (${userCheck.role})`);
      
      // Use the database function that bypasses RLS
      logStep('Deleting all user data via database function', userId);
      const { data: deletionResult, error: deletionError } = await supabase
        .rpc('admin_delete_user_data', { target_user_id: userId });

      if (deletionError) {
        console.error(`[userDeletion] Database deletion RPC error:`, {
          message: deletionError.message,
          code: deletionError.code,
          details: deletionError.details,
          hint: deletionError.hint
        });
        throw deletionError;
      }

      if (!deletionResult?.success) {
        console.error(`[userDeletion] Database deletion returned failure:`, deletionResult);
        const dbError = new Error(deletionResult?.error || 'Database deletion failed');
        (dbError as any).code = deletionResult?.error_code || 'DATABASE_ERROR';
        throw dbError;
      }

      console.log(`[userDeletion] Database deletion completed in ${deletionResult.duration_ms}ms`);
      console.log(`[userDeletion] Security logs preserved: ${deletionResult.security_logs_preserved || 0}`);

      // Finally delete from auth.users
      logStep('Deleting user from Auth', userId);
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) {
        console.error(`[userDeletion] Auth deletion error:`, {
          message: deleteError.message,
          status: deleteError.status,
          name: deleteError.name
        });
        throw deleteError;
      }

      logStep('User deleted successfully', userId);
      
      // Log transaction completion
      const transactionEnd = Date.now();
      const duration = transactionEnd - transactionStart;
      console.log(`[userDeletion] ✅ Transaction completed successfully for user ${userId} in ${duration}ms after ${attempt} attempt(s)`);
      
      return { 
        success: true, 
        message: 'User deleted successfully',
        transactionDuration: duration,
        deletedUserId: userId,
        attemptsRequired: attempt,
        securityLogsPreserved: deletionResult.security_logs_preserved || 0
      };

    } catch (error) {
      // Categorize the error
      lastError = categorizeDeletionError(error);
      
      console.error(`[userDeletion] Attempt ${attempt}/${maxRetries} failed:`, {
        errorCode: lastError.code,
        errorMessage: lastError.message,
        isRetryable: lastError.isRetryable,
        httpStatus: lastError.httpStatus,
        userId,
        adminId
      });

      // If error is not retryable or we've exhausted retries, throw immediately
      if (!lastError.isRetryable || attempt === maxRetries) {
        const transactionEnd = Date.now();
        const duration = transactionEnd - transactionStart;
        
        console.error(`[userDeletion] ❌ Transaction failed permanently for user ${userId} after ${duration}ms and ${attempt} attempt(s)`);
        
        throw {
          success: false,
          code: lastError.code,
          message: lastError.message,
          httpStatus: lastError.httpStatus,
          transactionDuration: duration,
          attemptsRequired: attempt,
          isRetryable: lastError.isRetryable,
          userId
        };
      }

      // Calculate exponential backoff delay: 1s, 2s, 4s
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`[userDeletion] Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }

  // This should never be reached, but just in case
  const transactionEnd = Date.now();
  const duration = transactionEnd - transactionStart;
  throw {
    success: false,
    code: lastError?.code || 'UNKNOWN_ERROR',
    message: lastError?.message || 'Maximum retries exceeded',
    httpStatus: lastError?.httpStatus || 500,
    transactionDuration: duration,
    attemptsRequired: maxRetries,
    isRetryable: false,
    userId
  };
}
