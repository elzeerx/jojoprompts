
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
        
        // Also backup payment context
        const context = {
          userId,
          planId,
          orderId,
          timestamp: Date.now()
        };
        localStorage.setItem(this.CONTEXT_KEY, JSON.stringify(context));
        
        console.log('Session backed up successfully for PayPal flow');
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
        console.log('Valid session already exists');
        return { success: true, user: currentSession.user };
      }

      // Try to restore from backup
      const backupData = localStorage.getItem(this.BACKUP_KEY);
      const contextData = localStorage.getItem(this.CONTEXT_KEY);
      
      if (backupData) {
        const backup: SessionBackup = JSON.parse(backupData);
        const context = contextData ? JSON.parse(contextData) : null;
        
        // Check if backup is not too old (30 minutes)
        const isExpired = Date.now() - backup.timestamp > 30 * 60 * 1000;
        if (isExpired) {
          console.log('Session backup expired, cleaning up');
          this.cleanup();
          return { success: false };
        }

        // Attempt session restoration
        const { data: restored, error } = await supabase.auth.setSession({
          access_token: backup.access_token,
          refresh_token: backup.refresh_token
        });

        if (!error && restored.session?.user) {
          console.log('Session restored successfully from backup');
          this.cleanup(); // Clean up after successful restoration
          return { 
            success: true, 
            user: restored.session.user,
            context 
          };
        } else {
          console.error('Failed to restore session:', error);
        }
      }

      return { success: false };
    } catch (error) {
      console.error('Session restoration error:', error);
      this.cleanup();
      return { success: false };
    }
  }

  static cleanup() {
    localStorage.removeItem(this.BACKUP_KEY);
    localStorage.removeItem(this.CONTEXT_KEY);
  }

  static getPaymentContext() {
    try {
      const contextData = localStorage.getItem(this.CONTEXT_KEY);
      return contextData ? JSON.parse(contextData) : null;
    } catch {
      return null;
    }
  }
}
