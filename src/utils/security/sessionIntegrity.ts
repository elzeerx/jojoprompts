// Session integrity validation for enhanced security
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logging';

const logger = createLogger('SESSION_INTEGRITY');

export interface SessionFingerprint {
  userAgent: string;
  screen: string;
  timezone: string;
  language: string;
}

export class SessionIntegrity {
  private static generateFingerprint(): SessionFingerprint {
    return {
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language
    };
  }

  private static hashFingerprint(fingerprint: SessionFingerprint): string {
    const str = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  static async validateSession(): Promise<{ isValid: boolean; reason?: string }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return { isValid: false, reason: 'No active session' };
      }

      // Generate current fingerprint
      const currentFingerprint = this.generateFingerprint();
      const currentHash = this.hashFingerprint(currentFingerprint);

      // Check session integrity in database
      const { data: sessionData, error } = await supabase
        .from('session_integrity')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_valid', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to validate session integrity:', error);
        return { isValid: false, reason: 'Session validation failed' };
      }

      if (!sessionData) {
        // Create new session integrity record
        await this.createSessionRecord(session.user.id, currentHash);
        return { isValid: true };
      }

      // Validate fingerprint hasn't changed significantly
      if (sessionData.fingerprint_hash !== currentHash) {
        logger.warn('Session fingerprint mismatch detected', {
          userId: session.user.id,
          storedHash: sessionData.fingerprint_hash,
          currentHash
        });
        
        // Mark session as invalid
        await supabase
          .from('session_integrity')
          .update({ is_valid: false })
          .eq('id', sessionData.id);

        return { isValid: false, reason: 'Session fingerprint mismatch' };
      }

      // Update last activity
      await supabase
        .from('session_integrity')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', sessionData.id);

      return { isValid: true };
    } catch (error) {
      logger.error('Session validation error:', error);
      return { isValid: false, reason: 'Validation error' };
    }
  }

  private static async createSessionRecord(userId: string, fingerprintHash: string): Promise<void> {
    try {
      // Get session for token hash (simplified approach)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      await supabase
        .from('session_integrity')
        .insert({
          user_id: userId,
          session_token_hash: session.access_token.substring(0, 32), // Use part of token
          fingerprint_hash: fingerprintHash,
          ip_address: 'client-side', // Would need server-side implementation for real IP
          user_agent: navigator.userAgent
        });
    } catch (error) {
      logger.error('Failed to create session record:', error);
    }
  }

  static async invalidateSession(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Mark all user sessions as invalid
        await supabase
          .from('session_integrity')
          .update({ is_valid: false })
          .eq('user_id', session.user.id);
      }

      // Sign out
      await supabase.auth.signOut();
    } catch (error) {
      logger.error('Failed to invalidate session:', error);
    }
  }
}