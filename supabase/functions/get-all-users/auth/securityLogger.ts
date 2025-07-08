
import { SecurityEvent } from './types.ts';

// Enhanced security event logging
export async function logSecurityEvent(
  supabase: any, 
  event: SecurityEvent
): Promise<void> {
  try {
    await supabase
      .from('security_logs')
      .insert({
        ...event,
        created_at: new Date().toISOString(),
        ip_address: 'edge-function', // Would be actual IP in production
        user_agent: 'supabase-edge-function'
      });
  } catch (error) {
    console.warn('Failed to log security event:', error);
    // Don't throw - logging failures shouldn't block operations
  }
}
