import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('shared:security-logger');

// Shared security logging utilities for edge functions
export interface SecurityEvent {
  user_id?: string;
  action: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export async function logSecurityEvent(
  supabase: any,
  event: SecurityEvent
): Promise<void> {
  try {
    await supabase
      .from('security_logs')
      .insert({
        ...event,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    logger.warn('Failed to log security event', { error });
    // Don't throw - logging failures shouldn't block operations
  }
}

export async function logAdminAction(
  supabase: any,
  adminUserId: string,
  action: string,
  targetResource: string,
  metadata?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  try {
    await supabase
      .from('admin_audit_log')
      .insert({
        admin_user_id: adminUserId,
        action,
        target_resource: targetResource,
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
        ip_address: ipAddress || 'edge-function'
      });
  } catch (error) {
    logger.warn('Failed to log admin action', { error });
    // Don't throw - logging failures shouldn't block operations
  }
}
