import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { securityMonitor } from "@/utils/monitoring";
import { SecurityUtils } from "@/utils/security";
import { logInfo, logWarn, logError } from "@/utils/secureLogging";
import { SecurityEnforcer } from "@/utils/enhancedSecurity";
import { InputValidator } from "@/utils/inputValidation";
import { RateLimiter, RateLimitConfigs } from "@/utils/rateLimiting";

export function useUserActions() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const { session, user } = useAuth();

  const sendPasswordResetEmail = async (email: string) => {
    try {
      // Enhanced email validation
      const emailValidation = InputValidator.validateEmail(email);
      if (!emailValidation.isValid) {
        throw new Error(emailValidation.error);
      }

      // Check rate limiting for password resets
      const rateLimitKey = `password_reset_${email}`;
      const rateLimitCheck = RateLimiter.isAllowed(rateLimitKey, RateLimitConfigs.PASSWORD_RESET);
      
      if (!rateLimitCheck.allowed) {
        const retryMessage = rateLimitCheck.retryAfter 
          ? ` Please try again in ${rateLimitCheck.retryAfter} seconds.`
          : '';
        throw new Error(`Too many password reset attempts.${retryMessage}`);
      }

      // Check if user has admin permissions
      if (!user || user.role !== 'admin') {
        logWarn("Password reset attempted without admin permissions", "admin", undefined, user?.id);
        securityMonitor.logEvent('access_denied', {
          action: 'password_reset',
          reason: 'insufficient_permissions'
        }, user?.id);
        throw new Error('Insufficient permissions');
      }

      // Log the attempt
      SecurityEnforcer.logAuthAttempt('password_reset', email, false, 'Admin initiated');

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        logError("Password reset email failed", "admin", { error: error.message }, user?.id);
        securityMonitor.logEvent('auth_failure', {
          action: 'password_reset_email',
          error: error.message
        }, user?.id);
        throw error;
      }

      // Log successful action
      SecurityEnforcer.logAuthAttempt('password_reset', email, true);
      logInfo("Password reset email sent successfully", "admin", undefined, user.id);
      
      toast({
        title: "Password reset email sent",
        description: "A password reset email has been sent",
      });
    } catch (error: any) {
      logError("Error sending reset email", "admin", { error: error.message }, user?.id);
      toast({
        title: "Error sending email",
        description: error.message || "Failed to send password reset email",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    // Enhanced input validation
    if (!InputValidator.validateUUID(userId)) {
      logWarn("Invalid UUID for user deletion", "admin", { userId }, user?.id);
      toast({
        title: "Invalid Input",
        description: "Invalid user ID format",
        variant: "destructive",
      });
      return false;
    }

    const emailValidation = InputValidator.validateEmail(email);
    if (!emailValidation.isValid) {
      logWarn("Invalid email for user deletion", "admin", { error: emailValidation.error }, user?.id);
      toast({
        title: "Invalid Input",
        description: emailValidation.error,
        variant: "destructive",
      });
      return false;
    }

    // Check permissions
    if (!user || user.role !== 'admin') {
      logWarn("User deletion attempted without admin permissions", "admin", undefined, user?.id);
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
      logWarn("Admin attempted to delete own account", "admin", undefined, user.id);
      toast({
        title: "Action Not Allowed",
        description: "You cannot delete your own account",
        variant: "destructive",
      });
      return false;
    }

    // Check for suspicious activity
    const isSuspicious = SecurityEnforcer.detectSuspiciousActivity('user_deletion', {
      targetUserId: userId.substring(0, 8) + "***",
      adminId: user.id.substring(0, 8) + "***"
    });

    if (isSuspicious) {
      toast({
        title: "Action Temporarily Blocked",
        description: "Too many deletion attempts. Please wait before trying again.",
        variant: "destructive",
      });
      return false;
    }

    const sanitizedEmail = InputValidator.sanitizeText(email);
    
    if (!window.confirm(`Are you sure you want to permanently delete this user? This action cannot be undone.`)) {
      return false;
    }

    setProcessingUserId(userId);
    try {
      if (!session) {
        logError("User deletion attempted without session", "admin", undefined, user?.id);
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
        
        logError("User deletion failed", "admin", { error: errorMessage }, user?.id);
        securityMonitor.logEvent('access_denied', {
          action: 'delete_user',
          error: errorMessage,
          targetUserId: userId
        }, user?.id);
        
        throw new Error(errorMessage);
      }
      
      // Log successful deletion (without exposing user details)
      logInfo("User deleted successfully", "admin", { targetUserId: userId.substring(0, 8) + "***" }, user.id);
      
      toast({
        title: "User Deleted",
        description: "User has been permanently deleted.",
      });

      return true;
    } catch (error: any) {
      logError("Error deleting user", "admin", { error: error.message }, user?.id);
      
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
