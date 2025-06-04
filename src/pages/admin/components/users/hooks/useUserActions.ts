
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { securityMonitor } from "@/utils/monitoring";
import { SecurityUtils } from "@/utils/security";

export function useUserActions() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const { session, user } = useAuth();

  const sendPasswordResetEmail = async (email: string) => {
    try {
      // Validate email format
      if (!SecurityUtils.isValidEmail(email)) {
        throw new Error('Invalid email format');
      }

      // Check if user has admin permissions
      if (!user || user.role !== 'admin') {
        securityMonitor.logEvent('access_denied', {
          action: 'password_reset',
          reason: 'insufficient_permissions'
        }, user?.id);
        throw new Error('Insufficient permissions');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?tab=reset`,
      });
      
      if (error) {
        securityMonitor.logEvent('auth_failure', {
          action: 'password_reset_email',
          error: error.message
        }, user?.id);
        throw error;
      }

      // Log successful action
      console.log(`Password reset email sent to ${email} by admin ${user.id}`);
      
      toast({
        title: "Password reset email sent",
        description: `An email has been sent to ${email}`,
      });
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      toast({
        title: "Error sending email",
        description: error.message || "Failed to send password reset email",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    // Input validation
    if (!SecurityUtils.isValidUUID(userId) || !SecurityUtils.isValidEmail(email)) {
      toast({
        title: "Invalid Input",
        description: "Invalid user ID or email format",
        variant: "destructive",
      });
      return false;
    }

    // Check permissions
    if (!user || user.role !== 'admin') {
      securityMonitor.logEvent('access_denied', {
        action: 'delete_user',
        targetUserId: userId,
        reason: 'insufficient_permissions'
      }, user?.id);
      
      toast({
        title: "Access Denied",
        description: "You don't have permission to delete users",
        variant: "destructive",
      });
      return false;
    }

    // Prevent self-deletion
    if (userId === user.id) {
      toast({
        title: "Action Not Allowed",
        description: "You cannot delete your own account",
        variant: "destructive",
      });
      return false;
    }

    const sanitizedEmail = SecurityUtils.sanitizeUserInput(email);
    
    if (!window.confirm(`Are you sure you want to permanently delete user: ${sanitizedEmail}? This action cannot be undone.`)) {
      return false;
    }

    setProcessingUserId(userId);
    try {
      if (!session) {
        securityMonitor.logEvent('auth_failure', {
          action: 'delete_user',
          reason: 'no_session'
        }, user?.id);
        
        toast({
          title: "Authentication Error",
          description: "Admin authentication is required for user deletion.",
          variant: "destructive",
        });
        return false;
      }
      
      // Call edge function with proper error handling
      const { data, error } = await supabase.functions.invoke(
        "get-all-users",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: { 
            userId, 
            action: "delete"
          }
        }
      );

      if (error || (data && data.error)) {
        const errorMessage = error?.message || data?.error || "Error deleting user";
        
        securityMonitor.logEvent('access_denied', {
          action: 'delete_user',
          error: errorMessage,
          targetUserId: userId
        }, user?.id);
        
        throw new Error(errorMessage);
      }
      
      // Log successful deletion
      console.log(`User ${userId} (${sanitizedEmail}) deleted by admin ${user.id}`);
      
      toast({
        title: "User Deleted",
        description: `User ${sanitizedEmail} has been permanently deleted.`,
      });

      return true;
    } catch (error: any) {
      console.error("Error deleting user:", error);
      
      securityMonitor.logEvent('payment_error', {
        action: 'delete_user',
        error: error.message,
        targetUserId: userId
      }, user?.id);
      
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  return {
    processingUserId,
    sendPasswordResetEmail,
    deleteUser
  };
}
