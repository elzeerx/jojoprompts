// Session security management with timeout controls
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

export interface SessionConfig {
  maxIdleTime: number; // milliseconds
  maxSessionDuration: number; // milliseconds
  requireReauth: boolean;
  ipBinding: boolean;
  deviceFingerprinting: boolean;
}

export interface SessionSecurity {
  sessionId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  securityFlags: string[];
  riskScore: number;
}

// Default session configurations for different user levels
export const SESSION_CONFIGS: Record<string, SessionConfig> = {
  SUPER_ADMIN: {
    maxIdleTime: 15 * 60 * 1000, // 15 minutes
    maxSessionDuration: 2 * 60 * 60 * 1000, // 2 hours
    requireReauth: true,
    ipBinding: true,
    deviceFingerprinting: true
  },
  ADMIN: {
    maxIdleTime: 30 * 60 * 1000, // 30 minutes
    maxSessionDuration: 4 * 60 * 60 * 1000, // 4 hours
    requireReauth: true,
    ipBinding: true,
    deviceFingerprinting: false
  },
  JADMIN: {
    maxIdleTime: 60 * 60 * 1000, // 1 hour
    maxSessionDuration: 8 * 60 * 60 * 1000, // 8 hours
    requireReauth: false,
    ipBinding: true,
    deviceFingerprinting: false
  },
  REGULAR: {
    maxIdleTime: 24 * 60 * 60 * 1000, // 24 hours
    maxSessionDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
    requireReauth: false,
    ipBinding: false,
    deviceFingerprinting: false
  }
};

export class SessionSecurityManager {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  async validateSession(
    token: string,
    userRole: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    valid: boolean;
    expired?: boolean;
    securityViolation?: string;
    requiresReauth?: boolean;
  }> {
    try {
      // Get session config based on user role
      const config = this.getSessionConfig(userRole);
      
      // Validate token with Supabase
      const { data: { user }, error } = await this.supabase.auth.getUser(token);
      
      if (error || !user) {
        await this.logSessionEvent('session_validation_failed', user?.id, {
          error: error?.message,
          ip_address: ipAddress
        });
        
        return { valid: false };
      }

      // Get session record
      const sessionRecord = await this.getSessionRecord(user.id, token);
      
      if (!sessionRecord) {
        // Create new session record
        await this.createSessionRecord(user.id, token, ipAddress, userAgent, config);
        return { valid: true };
      }

      // Check session expiry
      const now = Date.now();
      const sessionAge = now - sessionRecord.createdAt.getTime();
      const idleTime = now - sessionRecord.lastActivity.getTime();

      // Check max session duration
      if (sessionAge > config.maxSessionDuration) {
        await this.invalidateSession(user.id, token, 'max_duration_exceeded');
        return { 
          valid: false, 
          expired: true,
          securityViolation: 'Maximum session duration exceeded'
        };
      }

      // Check idle timeout
      if (idleTime > config.maxIdleTime) {
        await this.invalidateSession(user.id, token, 'idle_timeout');
        return { 
          valid: false, 
          expired: true,
          securityViolation: 'Session idle timeout'
        };
      }

      // IP binding check
      if (config.ipBinding && sessionRecord.ipAddress !== ipAddress) {
        await this.invalidateSession(user.id, token, 'ip_mismatch');
        await this.logSecurityViolation(user.id, 'session_ip_mismatch', {
          original_ip: sessionRecord.ipAddress,
          current_ip: ipAddress
        });
        
        return { 
          valid: false,
          securityViolation: 'IP address mismatch detected'
        };
      }

      // Device fingerprinting check (simplified)
      if (config.deviceFingerprinting && sessionRecord.userAgent !== userAgent) {
        await this.logSecurityViolation(user.id, 'device_fingerprint_mismatch', {
          original_agent: sessionRecord.userAgent,
          current_agent: userAgent
        });
        
        // Don't invalidate immediately, but flag for review
        sessionRecord.securityFlags.push('device_change');
        sessionRecord.riskScore += 5;
      }

      // Update last activity
      await this.updateSessionActivity(user.id, token);

      // Check if reauthentication is required
      const requiresReauth = config.requireReauth && 
        sessionAge > (config.maxSessionDuration / 2); // Reauth at half session duration

      return { 
        valid: true,
        requiresReauth
      };

    } catch (error) {
      console.error('Session validation error:', error);
      return { 
        valid: false,
        securityViolation: 'Session validation failed'
      };
    }
  }

  async createSessionRecord(
    userId: string,
    token: string,
    ipAddress: string,
    userAgent: string,
    config: SessionConfig
  ): Promise<void> {
    try {
      const sessionId = this.generateSessionId();
      const now = new Date();

      await this.supabase
        .from('active_sessions')
        .insert({
          session_id: sessionId,
          user_id: userId,
          token_hash: await this.hashToken(token),
          ip_address: ipAddress,
          user_agent: userAgent,
          created_at: now.toISOString(),
          last_activity: now.toISOString(),
          expires_at: new Date(now.getTime() + config.maxSessionDuration).toISOString(),
          is_active: true,
          security_flags: [],
          risk_score: 0,
          config: config
        });

      await this.logSessionEvent('session_created', userId, {
        session_id: sessionId,
        ip_address: ipAddress,
        config: config
      });

    } catch (error) {
      console.error('Failed to create session record:', error);
    }
  }

  async invalidateSession(
    userId: string,
    token: string,
    reason: string
  ): Promise<void> {
    try {
      const tokenHash = await this.hashToken(token);
      
      await this.supabase
        .from('active_sessions')
        .update({ 
          is_active: false,
          invalidated_at: new Date().toISOString(),
          invalidation_reason: reason
        })
        .eq('user_id', userId)
        .eq('token_hash', tokenHash);

      await this.logSessionEvent('session_invalidated', userId, {
        reason,
        token_hash: tokenHash.substring(0, 8) + '...'
      });

    } catch (error) {
      console.error('Failed to invalidate session:', error);
    }
  }

  async invalidateAllUserSessions(userId: string, reason: string): Promise<void> {
    try {
      await this.supabase
        .from('active_sessions')
        .update({ 
          is_active: false,
          invalidated_at: new Date().toISOString(),
          invalidation_reason: reason
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      await this.logSessionEvent('all_sessions_invalidated', userId, {
        reason
      });

    } catch (error) {
      console.error('Failed to invalidate all user sessions:', error);
    }
  }

  async getActiveSessions(userId: string): Promise<SessionSecurity[]> {
    try {
      const { data, error } = await this.supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false });

      if (error) {
        console.error('Failed to get active sessions:', error);
        return [];
      }

      return (data || []).map(session => ({
        sessionId: session.session_id,
        userId: session.user_id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        createdAt: new Date(session.created_at),
        lastActivity: new Date(session.last_activity),
        isActive: session.is_active,
        securityFlags: session.security_flags || [],
        riskScore: session.risk_score || 0
      }));

    } catch (error) {
      console.error('Failed to get active sessions:', error);
      return [];
    }
  }

  private async getSessionRecord(userId: string, token: string): Promise<SessionSecurity | null> {
    try {
      const tokenHash = await this.hashToken(token);
      
      const { data, error } = await this.supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('token_hash', tokenHash)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        sessionId: data.session_id,
        userId: data.user_id,
        ipAddress: data.ip_address,
        userAgent: data.user_agent,
        createdAt: new Date(data.created_at),
        lastActivity: new Date(data.last_activity),
        isActive: data.is_active,
        securityFlags: data.security_flags || [],
        riskScore: data.risk_score || 0
      };

    } catch (error) {
      console.error('Failed to get session record:', error);
      return null;
    }
  }

  private async updateSessionActivity(userId: string, token: string): Promise<void> {
    try {
      const tokenHash = await this.hashToken(token);
      
      await this.supabase
        .from('active_sessions')
        .update({ 
          last_activity: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('token_hash', tokenHash);

    } catch (error) {
      console.error('Failed to update session activity:', error);
    }
  }

  private getSessionConfig(userRole: string): SessionConfig {
    switch (userRole) {
      case 'admin':
        return SESSION_CONFIGS.ADMIN;
      case 'jadmin':
        return SESSION_CONFIGS.JADMIN;
      default:
        return SESSION_CONFIGS.REGULAR;
    }
  }

  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async logSessionEvent(action: string, userId: string, details: Record<string, any>): Promise<void> {
    try {
      await this.supabase
        .from('security_logs')
        .insert({
          user_id: userId,
          action: `session_${action}`,
          details: {
            ...details,
            timestamp: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log session event:', error);
    }
  }

  private async logSecurityViolation(userId: string, violation: string, details: Record<string, any>): Promise<void> {
    try {
      await this.supabase
        .from('security_logs')
        .insert({
          user_id: userId,
          action: violation,
          details: {
            ...details,
            severity: 'high',
            timestamp: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log security violation:', error);
    }
  }
}