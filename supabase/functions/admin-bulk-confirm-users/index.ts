import { serve, corsHeaders, handleCors, createErrorResponse, createSuccessResponse } from "../_shared/standardImports.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";
import { createEdgeLogger } from "../_shared/logger.ts";

const logger = createEdgeLogger('ADMIN_BULK_CONFIRM_USERS');

interface ConfirmUsersRequest {
  userIds?: string[];
  startDate?: string;
  endDate?: string;
  onlyWithActiveSubscriptions?: boolean;
  dryRun?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    // Verify admin authentication
    const { supabase, userId: adminUserId } = await verifyAdmin(req);
    
    logger.info('Bulk confirm users request', { adminUserId });

    if (req.method !== 'POST') {
      return createErrorResponse('Method not allowed', 405);
    }

    const body: ConfirmUsersRequest = await req.json();
    const { userIds, startDate, endDate, onlyWithActiveSubscriptions = false, dryRun = false } = body;

    let targetUserIds: string[] = [];

    // Determine which users to process
    if (userIds && userIds.length > 0) {
      targetUserIds = userIds;
    } else {
      // Query users based on date range and subscription status
      let query = supabase
        .from('profiles')
        .select('id, created_at, user_subscriptions!inner(status)');

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      if (onlyWithActiveSubscriptions) {
        query = query.eq('user_subscriptions.status', 'active');
      }

      const { data: profiles, error: profileError } = await query;

      if (profileError) {
        logger.error('Failed to query profiles', { error: profileError });
        throw new Error('Failed to query user profiles');
      }

      targetUserIds = profiles?.map(p => p.id) || [];
    }

    logger.info('Processing users', { 
      count: targetUserIds.length, 
      dryRun,
      onlyWithActiveSubscriptions 
    });

    if (targetUserIds.length === 0) {
      return createSuccessResponse({
        processed: 0,
        confirmed: 0,
        failed: 0,
        dryRun,
        message: 'No users found matching criteria'
      });
    }

    // If dry run, just return the count
    if (dryRun) {
      // Get user emails for preview
      const { data: previewUsers } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', targetUserIds.slice(0, 10)); // Preview first 10

      return createSuccessResponse({
        dryRun: true,
        totalUsers: targetUserIds.length,
        preview: previewUsers,
        message: `Would confirm ${targetUserIds.length} users`
      });
    }

    // Process confirmations
    const results = {
      processed: 0,
      confirmed: 0,
      failed: 0,
      errors: [] as any[]
    };

    const BATCH_SIZE = 10;
    for (let i = 0; i < targetUserIds.length; i += BATCH_SIZE) {
      const batch = targetUserIds.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (userId) => {
          try {
            // Update user email confirmation in auth
            const { data, error } = await supabase.auth.admin.updateUserById(userId, {
              email_confirm: true
            });

            if (error) throw error;

            // Log the confirmation in audit log
            await supabase.from('admin_audit_log').insert({
              admin_user_id: adminUserId,
              action: 'admin_confirm_email',
              target_resource: 'auth.users',
              metadata: {
                target_user_id: userId,
                reason: 'bulk_confirmation',
                date_range: { startDate, endDate },
                only_with_subscriptions: onlyWithActiveSubscriptions
              }
            });

            results.confirmed++;
            return { userId, success: true };
          } catch (err: any) {
            results.failed++;
            results.errors.push({ userId, error: err.message });
            logger.error('Failed to confirm user', { userId, error: err.message });
            return { userId, success: false, error: err.message };
          } finally {
            results.processed++;
          }
        })
      );
    }

    logger.info('Bulk confirmation completed', results);

    // Log summary in audit log
    await supabase.from('admin_audit_log').insert({
      admin_user_id: adminUserId,
      action: 'bulk_confirm_email_completed',
      target_resource: 'auth.users',
      metadata: {
        total_processed: results.processed,
        confirmed: results.confirmed,
        failed: results.failed,
        date_range: { startDate, endDate },
        only_with_subscriptions: onlyWithActiveSubscriptions
      }
    });

    return createSuccessResponse({
      ...results,
      message: `Confirmed ${results.confirmed} out of ${results.processed} users`
    }, corsHeaders);

  } catch (error: any) {
    logger.error('Function error', { error: error.message });
    
    const status = error.message === 'UNAUTHORIZED' ? 401 :
                   error.message === 'FORBIDDEN' ? 403 : 500;
    
    return createErrorResponse(error.message, status);
  }
});
