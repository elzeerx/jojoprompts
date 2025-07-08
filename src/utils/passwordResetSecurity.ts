// Enhanced password reset security with server-side validation

import { supabase } from '@/integrations/supabase/client';
import { logger } from './productionLogger';
import { enhancedRateLimiter, EnhancedRateLimitConfigs } from './enhancedRateLimiting';

export class PasswordResetSecurity {
  private static readonly RESET_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
  private static readonly MAX_RESET_ATTEMPTS = 3;

  static async validateResetToken(token: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      if (!token || typeof token !== 'string') {
        return { isValid: false, error: 'Invalid token format' };
      }

      // Check token format (basic validation)
      if (token.length < 20) {
        return { isValid: false, error: 'Token too short' };
      }

      // Rate limiting for token validation attempts
      const rateLimitKey = `password_reset_validation_${token.substring(0, 10)}`;
      const rateLimitCheck = enhancedRateLimiter.isAllowed(rateLimitKey, {
        maxAttempts: 5,
        windowMs: 5 * 60 * 1000, // 5 minutes
        blockDurationMs: 15 * 60 * 1000 // 15 minutes
      });

      if (!rateLimitCheck.allowed) {
        logger.warn('Password reset token validation rate limited', { token: token.substring(0, 10) });
        return { isValid: false, error: 'Too many validation attempts. Please try again later.' };
      }

      // Verify token with Supabase (this will validate server-side)
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'recovery'
      });

      if (error) {
        logger.warn('Password reset token validation failed', { error: error.message });
        return { isValid: false, error: 'Invalid or expired token' };
      }

      return { isValid: true };
    } catch (error) {
      logger.error('Password reset token validation error', { error });
      return { isValid: false, error: 'Token validation failed' };
    }
  }

  static async initiatePasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Enhanced email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Invalid email format' };
      }

      // Rate limiting for password reset requests
      const rateLimitKey = `password_reset_${email}`;
      const rateLimitCheck = enhancedRateLimiter.isAllowed(rateLimitKey, EnhancedRateLimitConfigs.PASSWORD_RESET);

      if (!rateLimitCheck.allowed) {
        const retryMessage = rateLimitCheck.retryAfter 
          ? ` Please try again in ${Math.ceil(rateLimitCheck.retryAfter / 60)} minutes.`
          : '';
        
        logger.warn('Password reset rate limited', { email: email.split('@')[1] });
        return { success: false, error: `Too many password reset attempts.${retryMessage}` };
      }

      // Send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        logger.error('Password reset initiation failed', { 
          error: error.message,
          email: email.split('@')[1] // Log domain only
        });
        return { success: false, error: error.message };
      }

      logger.info('Password reset initiated successfully', { email: email.split('@')[1] });
      return { success: true };
    } catch (error) {
      logger.error('Password reset initiation error', { error });
      return { success: false, error: 'Failed to initiate password reset' };
    }
  }

  static async updatePassword(newPassword: string, token?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate password strength
      if (newPassword.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters long' };
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
      if (!passwordRegex.test(newPassword)) {
        return { success: false, error: 'Password must contain uppercase, lowercase, number, and special character' };
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        logger.error('Password update failed', { error: error.message });
        return { success: false, error: error.message };
      }

      logger.info('Password updated successfully');
      return { success: true };
    } catch (error) {
      logger.error('Password update error', { error });
      return { success: false, error: 'Failed to update password' };
    }
  }
}