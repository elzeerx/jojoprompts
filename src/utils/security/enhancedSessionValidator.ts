import { supabase } from "@/integrations/supabase/client";
import { securityLogger } from "./securityLogger";
import { createLogger } from "../logging";

const logger = createLogger('EnhancedSessionValidator');

interface SessionValidationResult {
  isValid: boolean;
  reason?: string;
  shouldRefresh?: boolean;
  securityFlags?: string[];
}

export class EnhancedSessionValidator {
  private static lastValidation: number = 0;
  private static validationInterval: number = 5 * 60 * 1000; // 5 minutes
  private static securityFlags: Set<string> = new Set();

  static async validateSession(userId?: string): Promise<SessionValidationResult> {
    const now = Date.now();
    
    // Rate limit validation checks
    if (now - this.lastValidation < this.validationInterval) {
      return { isValid: true };
    }

    this.lastValidation = now;

    try {
      // Get current session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        securityLogger.logSecurityEvent({
          action: 'session_validation_error',
          userId,
          details: { error: error.message }
        });
        return { isValid: false, reason: 'Session validation failed' };
      }

      if (!session) {
        return { isValid: false, reason: 'No active session' };
      }

      // Check token expiration
      const expiresAt = session.expires_at;
      if (expiresAt && expiresAt * 1000 < now) {
        return { 
          isValid: false, 
          reason: 'Session expired',
          shouldRefresh: true 
        };
      }

      // Check if token expires soon (within 10 minutes)
      const shouldRefresh = expiresAt && (expiresAt * 1000 - now) < (10 * 60 * 1000);

      // Additional security checks
      const securityFlags = await this.performSecurityChecks(session, userId);

      // Log validation
      securityLogger.logSecurityEvent({
        action: 'session_validated',
        userId: session.user.id,
        details: {
          expiresAt,
          shouldRefresh,
          securityFlags: Array.from(securityFlags)
        }
      });

      return {
        isValid: true,
        shouldRefresh,
        securityFlags: Array.from(securityFlags)
      };

    } catch (error) {
      logger.error('Session validation error', { error: error instanceof Error ? error.message : error, userId });
      securityLogger.logSecurityEvent({
        action: 'session_validation_exception',
        userId,
        details: { error: String(error) }
      });
      return { isValid: false, reason: 'Validation exception' };
    }
  }

  private static async performSecurityChecks(session: any, userId?: string): Promise<Set<string>> {
    const flags = new Set<string>();

    try {
      // Check for concurrent sessions (if implemented)
      // This would require backend tracking

      // Check user agent consistency
      const storedUserAgent = localStorage.getItem('auth_user_agent');
      const currentUserAgent = navigator.userAgent;
      
      if (storedUserAgent && storedUserAgent !== currentUserAgent) {
        flags.add('user_agent_changed');
        securityLogger.logSuspiciousActivity(
          session.user.id,
          'User agent changed',
          { 
            stored: storedUserAgent,
            current: currentUserAgent 
          }
        );
      } else if (!storedUserAgent) {
        localStorage.setItem('auth_user_agent', currentUserAgent);
      }

      // Check for unusual access patterns
      const lastAccess = localStorage.getItem('last_access_time');
      const now = Date.now();
      
      if (lastAccess) {
        const timeDiff = now - parseInt(lastAccess);
        // Flag if more than 24 hours since last access
        if (timeDiff > 24 * 60 * 60 * 1000) {
          flags.add('long_absence');
        }
      }
      
      localStorage.setItem('last_access_time', now.toString());

      // Check session duration
      const sessionStart = localStorage.getItem('session_start_time');
      if (sessionStart) {
        const sessionDuration = now - parseInt(sessionStart);
        // Flag sessions longer than 12 hours
        if (sessionDuration > 12 * 60 * 60 * 1000) {
          flags.add('long_session');
        }
      } else {
        localStorage.setItem('session_start_time', now.toString());
      }

      // Verify user profile consistency
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', userId)
          .single();

        if (!profile) {
          flags.add('missing_profile');
          securityLogger.logSuspiciousActivity(
            userId,
            'Session user has no profile',
            { sessionUserId: session.user.id }
          );
        } else if (profile.id !== session.user.id) {
          flags.add('profile_mismatch');
          securityLogger.logSuspiciousActivity(
            userId,
            'Profile ID mismatch with session',
            { 
              profileId: profile.id,
              sessionUserId: session.user.id 
            }
          );
        }
      }

    } catch (error) {
      logger.warn('Security check error', { error: error instanceof Error ? error.message : error });
      flags.add('security_check_failed');
    }

    return flags;
  }

  static clearSecurityData() {
    // Clean up security-related localStorage items
    const securityKeys = [
      'auth_user_agent',
      'last_access_time',
      'session_start_time'
    ];

    securityKeys.forEach(key => {
      localStorage.removeItem(key);
    });

    this.securityFlags.clear();
    this.lastValidation = 0;
  }

  static getSecurityFlags(): string[] {
    return Array.from(this.securityFlags);
  }
}