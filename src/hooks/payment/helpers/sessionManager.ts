
import { supabase } from "@/integrations/supabase/client";

interface SessionBackup {
  access_token: string;
  refresh_token: string;
  user_id: string;
  timestamp: number;
}

export class SessionManager {
  private static readonly BACKUP_KEY = 'paypal_session_backup';
  private static readonly CONTEXT_KEY = 'paypal_payment_context';

  static async backupSession(userId: string, planId: string, orderId?: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        const backup: SessionBackup = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          user_id: userId,
          timestamp: Date.now()
        };
        
        localStorage.setItem(this.BACKUP_KEY, JSON.stringify(backup));
        
        // Also backup payment context with enhanced data
        const context = {
          userId,
          planId,
          orderId,
          timestamp: Date.now(),
          userEmail: session.user?.email || '',
          sessionId: session.access_token.substring(0, 20) // First 20 chars for identification
        };
        localStorage.setItem(this.CONTEXT_KEY, JSON.stringify(context));
        
        console.log('Enhanced session backed up successfully for PayPal flow', { userId, planId, orderId });
        return true;
      }
    } catch (error) {
      console.error('Failed to backup session:', error);
    }
    return false;
  }

  static async restoreSession(): Promise<{ success: boolean; user?: any; context?: any }> {
    try {
      // First check if we already have a valid session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        console.log('Valid session already exists, cleaning up backup');
        this.cleanup(); // Clean up since we have a valid session
        return { success: true, user: currentSession.user };
      }

      // Try to restore from backup
      const backupData = localStorage.getItem(this.BACKUP_KEY);
      const contextData = localStorage.getItem(this.CONTEXT_KEY);
      
      if (backupData) {
        const backup: SessionBackup = JSON.parse(backupData);
        const context = contextData ? JSON.parse(contextData) : null;
        
        // Check if backup is not too old (45 minutes - extended for PayPal flow)
        const isExpired = Date.now() - backup.timestamp > 45 * 60 * 1000;
        if (isExpired) {
          console.log('Session backup expired, cleaning up');
          this.cleanup();
          return { success: false };
        }

        console.log('Attempting session restoration from backup...', { 
          userId: backup.user_id, 
          age: Math.round((Date.now() - backup.timestamp) / 1000) + 's' 
        });

        // Attempt session restoration with retry logic
        let restoreAttempts = 0;
        const maxAttempts = 3;
        
        while (restoreAttempts < maxAttempts) {
          try {
            const { data: restored, error } = await supabase.auth.setSession({
              access_token: backup.access_token,
              refresh_token: backup.refresh_token
            });

            if (!error && restored.session?.user) {
              console.log('Session restored successfully from backup', { 
                userId: restored.session.user.id, 
                attempt: restoreAttempts + 1 
              });
              this.cleanup(); // Clean up after successful restoration
              return { 
                success: true, 
                user: restored.session.user,
                context 
              };
            } else {
              console.warn(`Session restore attempt ${restoreAttempts + 1} failed:`, error);
              restoreAttempts++;
              if (restoreAttempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
              }
            }
          } catch (restoreError) {
            console.error(`Session restore attempt ${restoreAttempts + 1} error:`, restoreError);
            restoreAttempts++;
            if (restoreAttempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        console.error('All session restore attempts failed');
        this.cleanup();
      }

      return { success: false };
    } catch (error) {
      console.error('Session restoration error:', error);
      this.cleanup();
      return { success: false };
    }
  }

  static cleanup(force: boolean = false) {
    try {
      if (force) {
        // Force cleanup - remove all auth-related items
        Object.keys(localStorage).forEach(key => {
          if (key.includes('paypal') || key.includes('session') || key.includes('auth')) {
            localStorage.removeItem(key);
          }
        });
      } else {
        // Normal cleanup
        localStorage.removeItem(this.BACKUP_KEY);
        localStorage.removeItem(this.CONTEXT_KEY);
      }
      console.log('Session backup cleanup completed', { force });
    } catch (error) {
      console.error('Error during session cleanup:', error);
    }
  }

  static getPaymentContext() {
    try {
      const contextData = localStorage.getItem(this.CONTEXT_KEY);
      return contextData ? JSON.parse(contextData) : null;
    } catch {
      return null;
    }
  }

  static hasBackup(): boolean {
    return !!localStorage.getItem(this.BACKUP_KEY);
  }
}
