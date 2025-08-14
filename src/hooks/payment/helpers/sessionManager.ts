
import { supabase } from "@/integrations/supabase/client";
import { safeLog } from "@/utils/safeLogging";

interface SessionBackup {
  access_token: string;
  refresh_token: string;
  user_id: string;
  timestamp: number;
}

export class SessionManager {
  private static readonly BACKUP_KEY = 'paypal_session_backup';
  private static readonly CONTEXT_KEY = 'paypal_payment_context';
  private static readonly FALLBACK_KEY = 'paypal_fallback_data';
  private static readonly RESTORATION_ATTEMPT_KEY = 'session_restoration_attempts';

  static async backupSession(userId: string, planId: string, orderId?: string): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        const backup: SessionBackup = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          user_id: userId,
          timestamp: Date.now()
        };
        
        // Enhanced backup with multiple storage strategies for better browser compatibility
        try {
          localStorage.setItem(this.BACKUP_KEY, JSON.stringify(backup));
        } catch (localStorageError) {
          // Fallback to sessionStorage if localStorage fails
          sessionStorage.setItem(this.BACKUP_KEY, JSON.stringify(backup));
          safeLog.warn('localStorage failed, using sessionStorage fallback', localStorageError);
        }
        
        // Enhanced payment context with additional recovery data
        const context = {
          userId,
          planId,
          orderId,
          timestamp: Date.now(),
          userEmail: session.user?.email || '',
          sessionId: session.access_token.substring(0, 20),
          browserInfo: {
            userAgent: navigator.userAgent.substring(0, 100),
            platform: navigator.platform,
            language: navigator.language
          },
          backupMethod: localStorage.getItem(this.BACKUP_KEY) ? 'localStorage' : 'sessionStorage'
        };
        
        try {
          localStorage.setItem(this.CONTEXT_KEY, JSON.stringify(context));
          // Also store in sessionStorage as backup
          sessionStorage.setItem(this.CONTEXT_KEY, JSON.stringify(context));
        } catch (contextError) {
          sessionStorage.setItem(this.CONTEXT_KEY, JSON.stringify(context));
          safeLog.warn('Context storage fallback used', contextError);
        }
        
        // Create minimal fallback data that doesn't require auth
        const fallbackData = { userId, planId, orderId, timestamp: Date.now() };
        try {
          localStorage.setItem(this.FALLBACK_KEY, JSON.stringify(fallbackData));
          sessionStorage.setItem(this.FALLBACK_KEY, JSON.stringify(fallbackData));
        } catch (fallbackError) {
          safeLog.warn('Fallback data storage failed', fallbackError);
        }
        
        safeLog.debug('Enhanced session backed up successfully for PayPal flow', { 
          userId, planId, orderId, method: context.backupMethod 
        });
        return true;
      }
    } catch (error) {
      safeLog.error('Failed to backup session:', error);
    }
    return false;
  }

  static async restoreSession(): Promise<{ success: boolean; user?: any; context?: any }> {
    try {
      // Track restoration attempts to prevent infinite loops
      const attempts = parseInt(localStorage.getItem(this.RESTORATION_ATTEMPT_KEY) || '0');
      if (attempts >= 5) {
        safeLog.warn('Max session restoration attempts reached, aborting');
        this.cleanup(true);
        return { success: false };
      }
      
      // Increment attempt counter
      localStorage.setItem(this.RESTORATION_ATTEMPT_KEY, (attempts + 1).toString());
      
      // First check if we already have a valid session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        safeLog.debug('Valid session already exists, cleaning up backup');
        this.cleanup(); // Clean up since we have a valid session
        return { success: true, user: currentSession.user };
      }

      // Try multiple sources for backup data
      let backupData: string | null = null;
      let contextData: string | null = null;
      let storageSource = '';
      
      // Try localStorage first, then sessionStorage
      if (localStorage.getItem(this.BACKUP_KEY)) {
        backupData = localStorage.getItem(this.BACKUP_KEY);
        contextData = localStorage.getItem(this.CONTEXT_KEY);
        storageSource = 'localStorage';
      } else if (sessionStorage.getItem(this.BACKUP_KEY)) {
        backupData = sessionStorage.getItem(this.BACKUP_KEY);
        contextData = sessionStorage.getItem(this.CONTEXT_KEY);
        storageSource = 'sessionStorage';
      }
      
      if (backupData) {
        const backup: SessionBackup = JSON.parse(backupData);
        const context = contextData ? JSON.parse(contextData) : null;
        
        // Extended expiration time for PayPal flow (60 minutes)
        const isExpired = Date.now() - backup.timestamp > 60 * 60 * 1000;
        if (isExpired) {
          safeLog.debug('Session backup expired, cleaning up');
          this.cleanup();
          return { success: false };
        }

        safeLog.debug('Attempting session restoration from backup...', { 
          userId: backup.user_id, 
          age: Math.round((Date.now() - backup.timestamp) / 1000) + 's',
          source: storageSource
        });

        // Enhanced retry logic with exponential backoff
        let restoreAttempts = 0;
        const maxAttempts = 5;
        
        while (restoreAttempts < maxAttempts) {
          try {
            const { data: restored, error } = await supabase.auth.setSession({
              access_token: backup.access_token,
              refresh_token: backup.refresh_token
            });

            if (!error && restored.session?.user) {
              safeLog.debug('Session restored successfully from backup', { 
                userId: restored.session.user.id, 
                attempt: restoreAttempts + 1,
                source: storageSource
              });
              
              // Reset attempt counter on success
              localStorage.removeItem(this.RESTORATION_ATTEMPT_KEY);
              this.cleanup(); // Clean up after successful restoration
              
              return { 
                success: true, 
                user: restored.session.user,
                context 
              };
            } else {
              safeLog.warn(`Session restore attempt ${restoreAttempts + 1} failed:`, error);
              restoreAttempts++;
              if (restoreAttempts < maxAttempts) {
                // Exponential backoff: 1s, 2s, 4s, 8s
                const delay = Math.pow(2, restoreAttempts) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          } catch (restoreError) {
            safeLog.error(`Session restore attempt ${restoreAttempts + 1} error:`, restoreError);
            restoreAttempts++;
            if (restoreAttempts < maxAttempts) {
              const delay = Math.pow(2, restoreAttempts) * 1000;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        safeLog.error('All session restore attempts failed');
        this.cleanup();
      }

      return { success: false };
    } catch (error) {
      safeLog.error('Session restoration error:', error);
      this.cleanup();
      return { success: false };
    }
  }

  static cleanup(force: boolean = false) {
    try {
      if (force) {
        // Force cleanup - remove all payment and auth-related items from both storages
        const cleanupKeys = [
          this.BACKUP_KEY, this.CONTEXT_KEY, this.FALLBACK_KEY, 
          this.RESTORATION_ATTEMPT_KEY, 'payPalSessionBackup'
        ];
        
        cleanupKeys.forEach(key => {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        });
        
        // Also clean up any remaining PayPal-related keys
        Object.keys(localStorage).forEach(key => {
          if (key.includes('paypal') || key.includes('payPal')) {
            localStorage.removeItem(key);
          }
        });
        
        Object.keys(sessionStorage).forEach(key => {
          if (key.includes('paypal') || key.includes('payPal')) {
            sessionStorage.removeItem(key);
          }
        });
      } else {
        // Normal cleanup - remove backup data but keep attempt counter temporarily
        [this.BACKUP_KEY, this.CONTEXT_KEY, this.FALLBACK_KEY].forEach(key => {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        });
        
        // Reset attempt counter after successful cleanup
        localStorage.removeItem(this.RESTORATION_ATTEMPT_KEY);
      }
      safeLog.debug('Session backup cleanup completed', { force });
    } catch (error) {
      safeLog.error('Error during session cleanup:', error);
    }
  }

  static getPaymentContext() {
    try {
      // Try localStorage first, then sessionStorage
      let contextData = localStorage.getItem(this.CONTEXT_KEY);
      if (!contextData) {
        contextData = sessionStorage.getItem(this.CONTEXT_KEY);
      }
      return contextData ? JSON.parse(contextData) : null;
    } catch {
      return null;
    }
  }

  static getFallbackData() {
    try {
      let fallbackData = localStorage.getItem(this.FALLBACK_KEY);
      if (!fallbackData) {
        fallbackData = sessionStorage.getItem(this.FALLBACK_KEY);
      }
      return fallbackData ? JSON.parse(fallbackData) : null;
    } catch {
      return null;
    }
  }

  static hasBackup(): boolean {
    return !!(localStorage.getItem(this.BACKUP_KEY) || sessionStorage.getItem(this.BACKUP_KEY));
  }

  static hasAnyRecoveryData(): boolean {
    return this.hasBackup() || !!this.getFallbackData() || !!this.getPaymentContext();
  }

  static getRestorationAttempts(): number {
    try {
      return parseInt(localStorage.getItem(this.RESTORATION_ATTEMPT_KEY) || '0');
    } catch {
      return 0;
    }
  }
}
