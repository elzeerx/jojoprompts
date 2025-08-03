
import { SecurityCheckParams } from './types.ts';
import { logSecurityEvent } from '../../shared/securityLogger.ts';

// Perform additional security checks
export async function performSecurityChecks(
  { supabase, userId, profile }: SecurityCheckParams
): Promise<void> {
  try {
    // Check for recent suspicious activity
    const { data: recentActivity, error } = await supabase
      .from('security_logs')
      .select('action, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.warn('Failed to check recent activity:', error.message);
      return; // Don't block on this check
    }

    // Check for multiple failed attempts
    const failedAttempts = recentActivity?.filter(
      log => log.action === 'admin_function_access_denied'
    ).length || 0;

    if (failedAttempts >= 5) {
      console.warn(`High number of failed admin access attempts for user ${userId}`);
      await logSecurityEvent(supabase, {
        user_id: userId,
        action: 'suspicious_admin_activity_detected',
        details: { failedAttempts, timeWindow: '24h' }
      });
    }

  } catch (error) {
    console.warn('Security checks failed:', error);
    // Don't throw - these are supplementary checks
  }
}
