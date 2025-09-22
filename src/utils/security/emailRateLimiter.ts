// Email rate limiting for unsubscribe and engagement protection
import { supabase } from '@/integrations/supabase/client';
import { EnhancedSecurityLogger } from './enhancedSecurityLogger';

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfter?: number;
  blocked: boolean;
}

export class EmailRateLimiter {
  private static readonly RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly BLOCK_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  static async checkRateLimit(email: string, ipAddress?: string): Promise<RateLimitResult> {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.RATE_LIMIT_WINDOW);
      
      // Use a fallback IP if not provided (client-side limitation)
      const clientIP = ipAddress || 'client-side';

      // Check if currently blocked
      const { data: blockedRecord } = await supabase
        .from('unsubscribe_rate_limits')
        .select('*')
        .eq('email', email)
        .eq('ip_address', clientIP)
        .not('blocked_until', 'is', null)
        .gte('blocked_until', now.toISOString())
        .single();

      if (blockedRecord) {
        const retryAfter = Math.ceil((new Date(blockedRecord.blocked_until).getTime() - now.getTime()) / 1000);
        
        await EnhancedSecurityLogger.logSystemEvent('email_rate_limit_blocked', 'medium', {
          email,
          ipAddress: clientIP,
          retryAfter
        });

        return {
          allowed: false,
          remainingAttempts: 0,
          retryAfter,
          blocked: true
        };
      }

      // Get or create current window record
      const { data: existingRecord } = await supabase
        .from('unsubscribe_rate_limits')
        .select('*')
        .eq('email', email)
        .eq('ip_address', clientIP)
        .gte('window_start', windowStart.toISOString())
        .single();

      if (existingRecord) {
        const remainingAttempts = this.MAX_ATTEMPTS - existingRecord.attempts;
        
        if (existingRecord.attempts >= this.MAX_ATTEMPTS) {
          // Block the email/IP combination
          const blockUntil = new Date(now.getTime() + this.BLOCK_DURATION);
          
          await supabase
            .from('unsubscribe_rate_limits')
            .update({
              blocked_until: blockUntil.toISOString()
            })
            .eq('id', existingRecord.id);

          await EnhancedSecurityLogger.logSystemEvent('email_rate_limit_exceeded', 'high', {
            email,
            ipAddress: clientIP,
            attempts: existingRecord.attempts,
            blockDuration: this.BLOCK_DURATION / 1000
          });

          return {
            allowed: false,
            remainingAttempts: 0,
            retryAfter: this.BLOCK_DURATION / 1000,
            blocked: true
          };
        }

        return {
          allowed: remainingAttempts > 0,
          remainingAttempts,
          blocked: false
        };
      }

      // No existing record, create new one
      return {
        allowed: true,
        remainingAttempts: this.MAX_ATTEMPTS - 1,
        blocked: false
      };

    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('email_rate_limit_error', 'medium', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fail open - allow the request but log the error
      return {
        allowed: true,
        remainingAttempts: this.MAX_ATTEMPTS,
        blocked: false
      };
    }
  }

  static async recordAttempt(email: string, ipAddress?: string): Promise<void> {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.RATE_LIMIT_WINDOW);
      const clientIP = ipAddress || 'client-side';

      // Try to update existing record
      const { data: existingRecord } = await supabase
        .from('unsubscribe_rate_limits')
        .select('*')
        .eq('email', email)
        .eq('ip_address', clientIP)
        .gte('window_start', windowStart.toISOString())
        .single();

      if (existingRecord) {
        await supabase
          .from('unsubscribe_rate_limits')
          .update({
            attempts: existingRecord.attempts + 1
          })
          .eq('id', existingRecord.id);
      } else {
        // Create new record
        await supabase
          .from('unsubscribe_rate_limits')
          .insert({
            email,
            ip_address: clientIP,
            attempts: 1,
            window_start: now.toISOString()
          });
      }

      await EnhancedSecurityLogger.logSystemEvent('email_rate_limit_attempt_recorded', 'info', {
        email,
        ipAddress: clientIP
      });

    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('email_rate_limit_record_error', 'medium', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async cleanupExpiredRecords(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - this.BLOCK_DURATION);
      
      await supabase
        .from('unsubscribe_rate_limits')
        .delete()
        .lt('created_at', cutoffTime.toISOString());

      await EnhancedSecurityLogger.logSystemEvent('email_rate_limit_cleanup', 'info', {
        cutoffTime: cutoffTime.toISOString()
      });

    } catch (error) {
      await EnhancedSecurityLogger.logSystemEvent('email_rate_limit_cleanup_error', 'medium', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}