
import { corsHeaders } from "../../_shared/standardImports.ts";
import { ParameterValidator } from "../../shared/parameterValidator.ts";
import { logAdminAction, logSecurityEvent } from "../../shared/securityLogger.ts";
import { deleteUser } from "../userDeletion.ts";

/**
 * Check if admin has permission to delete the target user
 */
async function canDeleteUser(
  supabase: any,
  adminId: string,
  targetUserId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Get admin profile (role only; email is not stored on profiles)
  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('role, first_name, last_name')
    .eq('id', adminId)
    .single();

  if (adminProfileError || !adminProfile) {
    console.warn('[canDeleteUser] Admin profile not found or error:', adminProfileError);
    return { allowed: false, reason: 'Admin privileges required' };
  }

  if (adminProfile.role !== 'admin') {
    return { allowed: false, reason: 'Admin privileges required' };
  }

  // Resolve admin email from auth (not from profiles)
  const { data: adminAuthUser, error: adminAuthError } = await supabase.auth.admin.getUserById(adminId);
  const adminEmail: string | undefined = adminAuthUser?.user?.email || undefined;

  if (adminAuthError) {
    console.warn('[canDeleteUser] Failed to resolve admin auth user/email:', adminAuthError);
  }

  // Get target user profile
  const { data: targetProfile, error: targetErr } = await supabase
    .from('profiles')
    .select('role, first_name, last_name')
    .eq('id', targetUserId)
    .single();

  if (targetErr || !targetProfile) {
    return { allowed: false, reason: 'Target user not found' };
  }

  // Only super admin (nawaf@elzeer.com) can delete other admins
  if (targetProfile.role === 'admin' && adminEmail !== 'nawaf@elzeer.com') {
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'unauthorized_admin_deletion_attempt',
      details: {
        target_user_id: targetUserId,
        target_name: `${targetProfile.first_name} ${targetProfile.last_name}`,
        admin_email: adminEmail || 'unknown'
      }
    });
    return { allowed: false, reason: 'Only super admin can delete administrator accounts' };
  }

  return { allowed: true };
}

/**
 * Check and enforce rate limiting for deletion operations
 */
async function checkDeletionRateLimit(
  supabase: any,
  adminId: string
): Promise<{ allowed: boolean; message?: string; retryAfter?: number }> {
  const windowMinutes = 60;
  const maxDeletions = 10;
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  // Count recent deletions by this admin
  const { data: recentDeletions, error } = await supabase
    .from('admin_audit_log')
    .select('id')
    .eq('admin_user_id', adminId)
    .in('action', ['delete_user', 'user_deletion_success'])
    .gte('timestamp', windowStart);

  if (error) {
    console.error('[checkDeletionRateLimit] Error checking rate limit:', error);
    return { allowed: true }; // Fail open to not block legitimate deletions
  }

  const deletionCount = recentDeletions?.length || 0;
  console.log(`[checkDeletionRateLimit] Admin ${adminId} has ${deletionCount}/${maxDeletions} deletions in the last ${windowMinutes} minutes`);

  if (deletionCount >= maxDeletions) {
    const retryAfterSeconds = windowMinutes * 60;
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'deletion_rate_limit_exceeded',
      details: {
        deletion_count: deletionCount,
        max_allowed: maxDeletions,
        window_minutes: windowMinutes
      }
    });
    return { 
      allowed: false, 
      message: `Too many deletion attempts. Maximum ${maxDeletions} deletions per ${windowMinutes} minutes.`,
      retryAfter: retryAfterSeconds 
    };
  }

  return { allowed: true };
}

export async function handleDeleteUser(supabase: any, adminId: string, requestBody: any) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  console.log(`[${requestId}] Starting user deletion request from admin ${adminId}`);

  try {
    // Extract userId from the already-parsed request body
    const userId = requestBody.userId;
    const ipAddress = requestBody.ip_address || 'unknown';
    const userAgent = requestBody.user_agent || 'unknown';
    
    console.log(`[${requestId}] Request details:`, { userId, adminId, ipAddress });

    // Validate userId parameter
    const validation = ParameterValidator.validateParameters(
      { userId },
      { userId: ParameterValidator.SCHEMAS.USER_DELETE.userId }
    );
    
    if (!validation.isValid) {
      console.error(`[${requestId}] Validation failed for userId ${userId}:`, validation.errors);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid user ID format',
          code: 'INVALID_INPUT', 
          details: validation.errors.join(', '),
          received: userId 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check rate limiting
    console.log(`[${requestId}] Checking rate limits for admin ${adminId}`);
    const rateLimitCheck = await checkDeletionRateLimit(supabase, adminId);
    if (!rateLimitCheck.allowed) {
      console.warn(`[${requestId}] Rate limit exceeded for admin ${adminId}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: rateLimitCheck.message || 'Too many deletion attempts. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitCheck.retryAfter
        }),
        {
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': rateLimitCheck.retryAfter?.toString() || '3600'
          }
        }
      );
    }

    // Check if user exists BEFORE deletion
    console.log(`[${requestId}] Verifying target user ${userId} exists`);
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name, email')
      .eq('id', userId)
      .maybeSingle();
      
    if (userCheckError) {
      console.error(`[${requestId}] Database error checking user:`, userCheckError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Database error while fetching user',
          code: 'DATABASE_ERROR', 
          details: userCheckError.message,
          userId: userId 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!existingUser) {
      console.warn(`[${requestId}] User ${userId} not found`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND', 
          details: 'User does not exist in the database',
          userId: userId 
        }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[${requestId}] Found user to delete:`, {
      id: existingUser.id,
      name: `${existingUser.first_name} ${existingUser.last_name}`,
      role: existingUser.role
    });

    // Check if admin has permission to delete this user
    console.log(`[${requestId}] Checking deletion permissions`);
    const permissionCheck = await canDeleteUser(supabase, adminId, userId);
    if (!permissionCheck.allowed) {
      console.warn(`[${requestId}] Permission denied: ${permissionCheck.reason}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: permissionCheck.reason || 'Permission denied',
          code: 'INSUFFICIENT_PERMISSIONS'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    console.log(`[${requestId}] Permission check passed`);

    // Log the user deletion attempt (critical action) with enhanced details
    console.log(`[${requestId}] Logging admin action before deletion`);
    await logAdminAction(supabase, adminId, 'delete_user', 'users', {
      target_user_id: userId,
      target_user_name: `${existingUser.first_name} ${existingUser.last_name}`,
      target_user_role: existingUser.role,
      target_user_email: existingUser.email,
      severity: 'critical',
      ip_address: ipAddress,
      user_agent: userAgent,
      request_id: requestId
    }, ipAddress);

    // Additional security check for user deletion
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'critical_user_deletion_attempt',
      details: { 
        target_user_id: userId,
        target_user_role: existingUser.role,
        ip_address: ipAddress,
        user_agent: userAgent,
        request_id: requestId
      }
    });

    // Enhanced logging before deletion
    console.log(`[${requestId}] Starting deletion process for user ${userId} (${existingUser.first_name} ${existingUser.last_name}) by admin ${adminId} from IP ${ipAddress}`);
    
    // Use the comprehensive deleteUser function from userDeletion.ts (with retry logic)
    const deletionResult = await deleteUser(supabase, userId, adminId);

    // Log successful user deletion with enhanced details
    console.log(`[${requestId}] Deletion successful, logging result`);
    await logAdminAction(supabase, adminId, 'user_deletion_success', 'users', {
      target_user_id: userId,
      target_user_name: `${existingUser.first_name} ${existingUser.last_name}`,
      target_user_role: existingUser.role,
      transaction_duration: deletionResult.transactionDuration,
      attempts_required: deletionResult.attemptsRequired,
      security_logs_preserved: deletionResult.securityLogsPreserved,
      ip_address: ipAddress,
      user_agent: userAgent,
      request_id: requestId,
      timestamp: new Date().toISOString()
    }, ipAddress);

    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_deleted',
      details: { 
        target_user_id: userId,
        target_user_name: `${existingUser.first_name} ${existingUser.last_name}`,
        transaction_duration: deletionResult.transactionDuration,
        attempts_required: deletionResult.attemptsRequired,
        success: true,
        ip_address: ipAddress,
        user_agent: userAgent,
        request_id: requestId
      }
    });

    console.log(`[${requestId}] ✅ User ${userId} (${existingUser.first_name} ${existingUser.last_name}) successfully deleted by admin ${adminId} in ${deletionResult.transactionDuration}ms after ${deletionResult.attemptsRequired} attempt(s)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User deleted successfully',
        data: {
          ...deletionResult,
          deletedUser: {
            id: userId,
            name: `${existingUser.first_name} ${existingUser.last_name}`,
            role: existingUser.role
          }
        }
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    const ipAddress = requestBody.ip_address || 'unknown';
    const userAgent = requestBody.user_agent || 'unknown';

    // Determine error details from structured error or raw error
    const errorCode = error.code || 'UNKNOWN_ERROR';
    const httpStatus = error.httpStatus || 500;
    const errorMessage = error.message || 'Failed to delete user';
    const isRetryable = error.isRetryable || false;

    console.error(`[${requestId}] ❌ Critical error deleting user ${requestBody.userId}:`, {
      code: errorCode,
      message: errorMessage,
      httpStatus,
      isRetryable,
      stack: error.stack?.substring(0, 500)
    });
    
    // Log the failure with enhanced details
    try {
      await logAdminAction(supabase, adminId, 'user_deletion_failure', 'users', {
        target_user_id: requestBody.userId,
        error: errorMessage,
        error_code: errorCode,
        http_status: httpStatus,
        is_retryable: isRetryable,
        stack: error.stack?.substring(0, 500),
        ip_address: ipAddress,
        user_agent: userAgent,
        request_id: requestId,
        timestamp: new Date().toISOString()
      }, ipAddress);
    } catch (logError) {
      console.error(`[${requestId}] Error logging failed deletion:`, logError);
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        code: errorCode,
        isRetryable,
        details: error.details || null,
        userId: requestBody.userId,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: httpStatus, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
