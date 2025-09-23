// Advanced Session Management with Fingerprinting and Concurrent Session Control

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/productionLogger';
import CryptoJS from 'crypto-js';

export interface SessionFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: number;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  webglVendor?: string;
  canvasFingerprint?: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  riskFactors: string[];
  actionRequired: 'none' | 'verify_identity' | 'reauthenticate' | 'location_verification';
  sessionId?: string;
  lastActivity?: Date;
}

export interface ActiveSession {
  id: string;
  deviceInfo: Record<string, any>;
  location: string;
  lastActivity: Date;
  riskScore: number;
  isCurrent: boolean;
}

export class AdvancedSessionManager {
  private static readonly MAX_CONCURRENT_SESSIONS = 3;
  private static readonly SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly FINGERPRINT_MISMATCH_THRESHOLD = 3;

  /**
   * Generate device fingerprint for session tracking
   */
  static generateFingerprint(): SessionFingerprint {
    if (typeof window === 'undefined') {
      throw new Error('Fingerprinting only available in browser environment');
    }

    const fingerprint: SessionFingerprint = {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      timezone: new Date().getTimezoneOffset(),
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled
    };

      // Add WebGL fingerprint if available
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') as WebGLRenderingContext;
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            fingerprint.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          }
        }
      } catch (error) {
        logger.warn('WebGL fingerprinting failed', { error });
      }

    // Add canvas fingerprint
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Session fingerprint 🔒', 2, 2);
        fingerprint.canvasFingerprint = canvas.toDataURL();
      }
    } catch (error) {
      logger.warn('Canvas fingerprinting failed', { error });
    }

    return fingerprint;
  }

  /**
   * Hash fingerprint for secure storage
   */
  static hashFingerprint(fingerprint: SessionFingerprint): string {
    const fingerprintString = JSON.stringify(fingerprint);
    return CryptoJS.SHA256(fingerprintString).toString();
  }

  /**
   * Create new session with fingerprinting
   */
  static async createSession(
    userId: string,
    sessionToken: string,
    fingerprint: SessionFingerprint,
    deviceInfo: Record<string, any> = {}
  ): Promise<string> {
    try {
      const sessionTokenHash = CryptoJS.SHA256(sessionToken).toString();
      const fingerprintHash = this.hashFingerprint(fingerprint);
      const expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT_MS);

      // Check concurrent session limit
      await this.enforceConcurrentSessionLimit(userId);

      // Insert new session
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_token_hash: sessionTokenHash,
          fingerprint_hash: fingerprintHash,
          ip_address: await this.getClientIP(),
          user_agent: fingerprint.userAgent,
          device_info: { ...deviceInfo, fingerprint: fingerprint as any },
          expires_at: expiresAt.toISOString(),
          location_data: await this.getLocationData()
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to create session', { error, userId });
        throw error;
      }

      logger.info('Session created successfully', { userId, sessionId: data.id });
      return data.id;
    } catch (error) {
      logger.error('Session creation failed', { error, userId });
      throw error;
    }
  }

  /**
   * Validate session integrity with fingerprinting
   */
  static async validateSession(
    userId: string,
    sessionToken: string,
    currentFingerprint: SessionFingerprint
  ): Promise<SessionValidationResult> {
    try {
      const sessionTokenHash = CryptoJS.SHA256(sessionToken).toString();
      const fingerprintHash = this.hashFingerprint(currentFingerprint);
      const clientIP = await this.getClientIP();

      // Call database function for validation
      const { data, error } = await supabase.rpc('validate_session_integrity', {
        p_user_id: userId,
        p_session_token_hash: sessionTokenHash,
        p_fingerprint_hash: fingerprintHash,
        p_ip_address: clientIP
      });

      if (error) {
        logger.error('Session validation failed', { error, userId });
        return {
          isValid: false,
          riskFactors: ['validation_error'],
          actionRequired: 'reauthenticate'
        };
      }

      return this.parseValidationResult(data);
    } catch (error) {
      logger.error('Session validation error', { error, userId });
      return {
        isValid: false,
        riskFactors: ['system_error'],
        actionRequired: 'reauthenticate'
      };
    }
  }

  /**
   * Detect and prevent session hijacking
   */
  static async detectSessionHijacking(
    userId: string,
    sessionId: string,
    suspiciousIndicators: string[]
  ): Promise<boolean> {
    try {
      // Check for multiple indicators of hijacking
      const riskScore = this.calculateHijackingRisk(suspiciousIndicators);
      
      if (riskScore > 70) {
        // High risk - invalidate session immediately
        await this.invalidateSession(sessionId);
        
        // Log security incident
        await supabase.from('security_logs').insert({
          user_id: userId,
          action: 'session_hijacking_detected',
          details: {
            session_id: sessionId,
            indicators: suspiciousIndicators,
            risk_score: riskScore
          },
          severity: 'high',
          event_category: 'security_incident'
        });

        logger.warn('Session hijacking detected', { userId, sessionId, riskScore });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Hijacking detection failed', { error, userId, sessionId });
      return false;
    }
  }

  /**
   * Get all active sessions for user
   */
  static async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('last_activity', { ascending: false });

      if (error) {
        logger.error('Failed to get active sessions', { error, userId });
        return [];
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const currentSessionToken = currentSession?.access_token;
      const currentSessionHash = currentSessionToken ? 
        CryptoJS.SHA256(currentSessionToken).toString() : null;

      return data.map(session => ({
        id: session.id,
        deviceInfo: (session.device_info || {}) as Record<string, any>,
        location: this.formatLocation(session.location_data),
        lastActivity: new Date(session.last_activity),
        riskScore: session.risk_score || 0,
        isCurrent: session.session_token_hash === currentSessionHash
      }));
    } catch (error) {
      logger.error('Failed to get active sessions', { error, userId });
      return [];
    }
  }

  /**
   * Terminate specific session
   */
  static async terminateSession(sessionId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to terminate session', { error, sessionId, userId });
        return false;
      }

      // Log session termination
      await supabase.from('security_logs').insert({
        user_id: userId,
        action: 'session_terminated',
        details: { session_id: sessionId },
        severity: 'info',
        event_category: 'session_management'
      });

      return true;
    } catch (error) {
      logger.error('Session termination failed', { error, sessionId, userId });
      return false;
    }
  }

  /**
   * Terminate all other sessions (keep current)
   */
  static async terminateOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true)
        .neq('id', currentSessionId)
        .select('id');

      if (error) {
        logger.error('Failed to terminate other sessions', { error, userId });
        return 0;
      }

      const terminatedCount = data?.length || 0;

      // Log bulk session termination
      if (terminatedCount > 0) {
        await supabase.from('security_logs').insert({
          user_id: userId,
          action: 'bulk_session_termination',
          details: { 
            terminated_count: terminatedCount,
            kept_session: currentSessionId 
          },
          severity: 'info',
          event_category: 'session_management'
        });
      }

      return terminatedCount;
    } catch (error) {
      logger.error('Bulk session termination failed', { error, userId });
      return 0;
    }
  }

  /**
   * Enforce concurrent session limit
   */
  private static async enforceConcurrentSessionLimit(userId: string): Promise<void> {
    try {
      const { data: activeSessions } = await supabase
        .from('user_sessions')
        .select('id, last_activity')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('last_activity', { ascending: true });

      if (!activeSessions || activeSessions.length < this.MAX_CONCURRENT_SESSIONS) {
        return;
      }

      // Terminate oldest sessions to make room
      const sessionsToTerminate = activeSessions.slice(0, 
        activeSessions.length - this.MAX_CONCURRENT_SESSIONS + 1);

      for (const session of sessionsToTerminate) {
        await this.invalidateSession(session.id);
      }

      logger.info('Enforced concurrent session limit', { 
        userId, 
        terminatedCount: sessionsToTerminate.length 
      });
    } catch (error) {
      logger.error('Failed to enforce session limit', { error, userId });
    }
  }

  /**
   * Invalidate session
   */
  private static async invalidateSession(sessionId: string): Promise<void> {
    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);
  }

  /**
   * Parse validation result from database
   */
  private static parseValidationResult(data: any): SessionValidationResult {
    return {
      isValid: data.is_valid || false,
      riskFactors: Object.keys(data.risk_factors || {}),
      actionRequired: data.action_required || 'reauthenticate',
      sessionId: data.session_id || undefined,
      lastActivity: data.last_activity ? new Date(data.last_activity) : undefined
    };
  }

  /**
   * Calculate hijacking risk score
   */
  private static calculateHijackingRisk(indicators: string[]): number {
    const riskMap: Record<string, number> = {
      'ip_change': 20,
      'user_agent_change': 30,
      'fingerprint_mismatch': 40,
      'unusual_location': 25,
      'rapid_requests': 15,
      'invalid_session_data': 50
    };

    return indicators.reduce((total, indicator) => 
      total + (riskMap[indicator] || 10), 0);
  }

  /**
   * Get client IP address
   */
  private static async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch (error) {
      logger.warn('Failed to get client IP', { error });
      return 'unknown';
    }
  }

  /**
   * Get location data based on IP
   */
  private static async getLocationData(): Promise<Record<string, any>> {
    try {
      // Simplified location detection - in production, use a proper service
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return { timezone, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.warn('Failed to get location data', { error });
      return {};
    }
  }

  /**
   * Format location for display
   */
  private static formatLocation(locationData: any): string {
    if (!locationData) return 'Unknown';
    return locationData.timezone || 'Unknown';
  }
}