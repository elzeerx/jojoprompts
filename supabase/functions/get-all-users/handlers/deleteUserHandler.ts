
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
): Promise<{ allowed: boolean; retryAfter?: number }> {
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
    console.error('Error checking rate limit:', error);
    return { allowed: true }; // Fail open to not block legitimate deletions
  }

  const deletionCount = recentDeletions?.length || 0;

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
    return { allowed: false, retryAfter: retryAfterSeconds };
  }

  return { allowed: true };
}

export async function handleDeleteUser(supabase: any, adminId: string, requestBody: any) {
  try {
    // Extract userId from the already-parsed request body
    const userId = requestBody.userId;
    const ipAddress = requestBody.ip_address || 'unknown';
    const userAgent = requestBody.user_agent || 'unknown';
    
    // Validate userId parameter
    const validation = ParameterValidator.validateParameters(
      { userId },
      { userId: ParameterValidator.SCHEMAS.USER_DELETE.userId }
    );
    
    if (!validation.isValid) {
      console.error(`[deleteUserHandler] Validation failed for userId ${userId}:`, validation.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid user ID format', 
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
    const rateLimitCheck = await checkDeletionRateLimit(supabase, adminId);
    if (!rateLimitCheck.allowed) {
      console.warn(`[deleteUserHandler] Rate limit exceeded for admin ${adminId}`);
      return new Response(
        JSON.stringify({
          error: 'Too many deletion attempts. Please try again later.',
          retryAfter: rateLimitCheck.retryAfter
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if user exists BEFORE deletion
    const { data: existingUser, error: userCheckError } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name')
      .eq('id', userId)
      .maybeSingle();
      
    if (userCheckError || !existingUser) {
      console.error(`[deleteUserHandler] User ${userId} not found:`, userCheckError);
      return new Response(
        JSON.stringify({ 
          error: 'User not found', 
          details: userCheckError?.message || 'User does not exist in the database',
          userId: userId 
        }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`[deleteUserHandler] Found user to delete: ${existingUser.first_name} ${existingUser.last_name} (${existingUser.role})`);

    // Check if admin has permission to delete this user
    const permissionCheck = await canDeleteUser(supabase, adminId, userId);
    if (!permissionCheck.allowed) {
      console.warn(`[deleteUserHandler] Permission denied: ${permissionCheck.reason}`);
      return new Response(
        JSON.stringify({
          error: permissionCheck.reason || 'Permission denied'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log the user deletion attempt (critical action) with enhanced details
    await logAdminAction(supabase, adminId, 'delete_user', 'users', {
      target_user_id: userId,
      target_user_name: `${existingUser.first_name} ${existingUser.last_name}`,
      target_user_role: existingUser.role,
      severity: 'critical',
      ip_address: ipAddress,
      user_agent: userAgent
    }, ipAddress);

    // Additional security check for user deletion
    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'critical_user_deletion_attempt',
      details: { 
        target_user_id: userId,
        target_user_role: existingUser.role,
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });

    // Enhanced logging before deletion
    console.log(`[deleteUserHandler] Starting deletion process for user ${userId} (${existingUser.first_name} ${existingUser.last_name}) by admin ${adminId} from IP ${ipAddress}`);
    
    // Use the comprehensive deleteUser function from userDeletion.ts
    const deletionResult = await deleteUser(supabase, userId, adminId);

    // Log successful user deletion with enhanced details
    await logAdminAction(supabase, adminId, 'user_deletion_success', 'users', {
      target_user_id: userId,
      target_user_name: `${existingUser.first_name} ${existingUser.last_name}`,
      target_user_role: existingUser.role,
      transaction_duration: deletionResult.transactionDuration,
      ip_address: ipAddress,
      user_agent: userAgent,
      timestamp: new Date().toISOString()
    }, ipAddress);

    await logSecurityEvent(supabase, {
      user_id: adminId,
      action: 'user_deleted',
      details: { 
        target_user_id: userId,
        target_user_email: `${existingUser.first_name} ${existingUser.last_name}`,
        transaction_duration: deletionResult.transactionDuration,
        success: true,
        ip_address: ipAddress,
        user_agent: userAgent
      }
    });

    console.log(`[deleteUserHandler] User ${userId} (${existingUser.first_name} ${existingUser.last_name}) successfully deleted by admin ${adminId} in ${deletionResult.transactionDuration}ms`);

    return new Response(
      JSON.stringify({
        ...deletionResult,
        deletedUser: {
          id: userId,
          name: `${existingUser.first_name} ${existingUser.last_name}`,
          role: existingUser.role
        }
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    const ipAddress = requestBody.ip_address || 'unknown';
    const userAgent = requestBody.user_agent || 'unknown';

    console.error(`[deleteUserHandler] Critical error deleting user ${requestBody.userId}:`, error);
    
    // Log the failure with enhanced details
    await logAdminAction(supabase, adminId, 'user_deletion_failure', 'users', {
      target_user_id: requestBody.userId,
      error: error.message,
      stack: error.stack?.substring(0, 500),
      ip_address: ipAddress,
      user_agent: userAgent,
      timestamp: new Date().toISOString()
    }, ipAddress);

    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete user', 
        details: error.message,
        userId: requestBody.userId,
        timestamp: new Date().toISOString()
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
