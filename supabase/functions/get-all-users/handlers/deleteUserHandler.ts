import { createEdgeLogger } from '../../_shared/logger.ts';
import { corsHeaders } from "../../_shared/standardImports.ts";
import { ParameterValidator } from "../../shared/parameterValidator.ts";
import { logAdminAction, logSecurityEvent } from "../../shared/securityLogger.ts";
import { deleteUser } from "../userDeletion.ts";

const logger = createEdgeLogger('get-all-users:delete-user');

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
    logger.warn('Admin profile not found or error', { error: adminProfileError });
    return { allowed: false, reason: 'Admin privileges required' };
  }

  if (adminProfile.role !== 'admin') {
    return { allowed: false, reason: 'Admin privileges required' };
  }

  // Resolve admin email from auth (not from profiles)
  const { data: adminAuthUser, error: adminAuthError } = await supabase.auth.admin.getUserById(adminId);
  const adminEmail: string | undefined = adminAuthUser?.user?.email || undefined;

  if (adminAuthError) {
    logger.warn('Failed to resolve admin auth user/email', { error: adminAuthError });
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
    logger.error('Error checking rate limit', { error });
    return { allowed: true }; // Fail open to not block legitimate deletions
  }

  const deletionCount = recentDeletions?.length || 0;
  logger.info('Checking deletion rate limit', { adminId, deletionCount, maxDeletions, windowMinutes });

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
  logger.info('Starting user deletion request', { requestId, adminId });

  try {
    // Extract userId from the already-parsed request body
    const userId = requestBody.userId;
    const ipAddress = requestBody.ip_address || 'unknown';
    const userAgent = requestBody.user_agent || 'unknown';
    
    logger.info('Request details', { requestId, userId, adminId, ipAddress });

    // Validate userId parameter
    const validation = ParameterValidator.validateParameters(
      { userId },
      { userId: ParameterValidator.SCHEMAS.USER_DELETE.userId }
    );
    
    if (!validation.isValid) {
      logger.error('Validation failed for userId', { requestId, userId, errors: validation.errors });
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
    logger.info('Checking rate limits', { requestId, adminId });
    const rateLimitCheck = await checkDeletionRateLimit(supabase, adminId);
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit exceeded', { requestId, adminId });
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
    logger.info('Verifying target user exists', { requestId, userId });
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name, email')
      .eq('id', userId)
      .maybeSingle();
      
    if (userCheckError) {
      logger.error('Database error checking user', { requestId, error: userCheckError });
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
      logger.warn('User not found', { requestId, userId });
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

    logger.info('Found user to delete', {
      requestId,
      id: existingUser.id,
      name: `${existingUser.first_name} ${existingUser.last_name}`,
      role: existingUser.role
    });

    // Check if admin has permission to delete this user
    logger.info('Checking deletion permissions', { requestId });
    const permissionCheck = await canDeleteUser(supabase, adminId, userId);
    if (!permissionCheck.allowed) {
      logger.warn('Permission denied', { requestId, reason: permissionCheck.reason });
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
    logger.info('Permission check passed', { requestId });

    // Log the user deletion attempt (critical action) with enhanced details
    logger.info('Logging admin action before deletion', { requestId });
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
    logger.info('Starting deletion process', { 
      requestId, 
      userId, 
      userName: `${existingUser.first_name} ${existingUser.last_name}`,
      adminId, 
      ipAddress 
    });
    
    // Use the comprehensive deleteUser function from userDeletion.ts (with retry logic)
    const deletionResult = await deleteUser(supabase, userId, adminId);

    // Log successful user deletion with enhanced details
    logger.info('Deletion successful, logging result', { requestId });
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

    logger.info('User successfully deleted', { 
      requestId, 
      userId, 
      userName: `${existingUser.first_name} ${existingUser.last_name}`,
      adminId,
      transactionDuration: deletionResult.transactionDuration,
      attemptsRequired: deletionResult.attemptsRequired
    });

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

    logger.error('Critical error deleting user', {
      requestId,
      userId: requestBody.userId,
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
      logger.error('Error logging failed deletion', { requestId, error: logError });
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
