// Enhanced session security with timeout and monitoring

import { supabase } from '@/integrations/supabase/client';
import { logger } from './productionLogger';

export class SessionSecurity {
  private static readonly SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly ACTIVITY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_CONCURRENT_SESSIONS = 3;
  
  private static activityTimer: NodeJS.Timeout | null = null;
  private static lastActivity: number = Date.now();

  static initialize() {
    this.startActivityMonitoring();
    this.checkSessionValidity();
  }

  static recordActivity() {
    this.lastActivity = Date.now();
  }

  private static startActivityMonitoring() {
    // Clear existing timer
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
    }

    // Monitor for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, () => this.recordActivity(), { passive: true });
    });

    // Check session timeout periodically
    this.activityTimer = setInterval(() => {
      this.checkSessionTimeout();
    }, this.ACTIVITY_CHECK_INTERVAL);
  }

  private static async checkSessionTimeout() {
    const timeSinceActivity = Date.now() - this.lastActivity;
    
    if (timeSinceActivity > this.SESSION_TIMEOUT_MS) {
      logger.warn('Session timeout detected', { timeSinceActivity });
      await this.invalidateSession();
    }
  }

  private static async checkSessionValidity() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        logger.error('Session validity check failed', { error: error.message });
        return false;
      }

      if (!session) {
        return false;
      }

      // Check if session is expired
      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        logger.warn('Session expired', { expiresAt: session.expires_at });
        await this.invalidateSession();
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Session validation error', { error });
      return false;
    }
  }

  private static async invalidateSession() {
    try {
      await supabase.auth.signOut();
      
      // Clear all auth-related storage
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('auth') || key.includes('session')) {
          localStorage.removeItem(key);
        }
      });

      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      logger.error('Session invalidation failed', { error });
      // Force redirect even if signOut fails
      window.location.href = '/login';
    }
  }

  static detectSuspiciousActivity(activity: string, metadata?: any) {
    const suspiciousPatterns = [
      'rapid_requests',
      'unusual_access_pattern',
      'multiple_failed_attempts',
      'session_manipulation'
    ];

    if (suspiciousPatterns.includes(activity)) {
      logger.warn('Suspicious activity detected', { activity, metadata });
      
      // For high-risk activities, invalidate session
      if (activity === 'session_manipulation') {
        this.invalidateSession();
      }
    }
  }

  static cleanup() {
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
  }
}