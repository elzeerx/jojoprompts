
// Enhanced security utilities

import { InputValidator } from './inputValidation';
import { RateLimiter, RateLimitConfigs } from './rateLimiting';
import { logWarn, logError } from './secureLogging';

export class SecurityEnforcer {
  // Enhanced authentication attempt logging
  static logAuthAttempt(
    action: 'login' | 'signup' | 'password_reset',
    email: string,
    success: boolean,
    error?: string
  ): void {
    const category = 'auth_security';
    
    if (success) {
      logWarn(`${action} successful`, category, undefined);
    } else {
      logError(`${action} failed`, category, { error });
      
      // Record failed attempt for rate limiting
      const key = `${action}_${email}`;
      RateLimiter.recordAttempt(key);
    }
  }

  // Check if authentication action is allowed
  static checkAuthRateLimit(
    action: 'login' | 'signup' | 'password_reset',
    email: string
  ): { allowed: boolean; retryAfter?: number } {
    const key = `${action}_${email}`;
    
    let config;
    switch (action) {
      case 'login':
        config = RateLimitConfigs.LOGIN;
        break;
      case 'signup':
        config = RateLimitConfigs.SIGNUP;
        break;
      case 'password_reset':
        config = RateLimitConfigs.PASSWORD_RESET;
        break;
      default:
        config = RateLimitConfigs.API_CALL;
    }

    return RateLimiter.isAllowed(key, config);
  }

  // Validate and sanitize user input
  static validateUserInput(data: {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.email) {
      const emailValidation = InputValidator.validateEmail(data.email);
      if (!emailValidation.isValid) {
        errors.push(emailValidation.error!);
      }
    }

    if (data.password) {
      const passwordValidation = InputValidator.validatePassword(data.password);
      if (!passwordValidation.isValid) {
        errors.push(passwordValidation.error!);
      }
    }

    if (data.firstName) {
      if (data.firstName.length < 1 || data.firstName.length > 50) {
        errors.push('First name must be between 1 and 50 characters');
      }
      data.firstName = InputValidator.sanitizeText(data.firstName, 50);
    }

    if (data.lastName) {
      if (data.lastName.length > 50) {
        errors.push('Last name must be less than 50 characters');
      }
      data.lastName = InputValidator.sanitizeText(data.lastName, 50);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Generate secure session identifiers
  static generateSecureId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Check for suspicious activity patterns
  static detectSuspiciousActivity(
    action: string,
    metadata: Record<string, any> = {}
  ): boolean {
    // Check for rapid repeated actions
    const rapidActionKey = `rapid_${action}`;
    const rapidCheck = RateLimiter.isAllowed(rapidActionKey, {
      maxAttempts: 10,
      windowMs: 60 * 1000 // 1 minute
    });

    if (!rapidCheck.allowed) {
      logWarn('Suspicious rapid activity detected', 'security', {
        action,
        ...metadata
      });
      return true;
    }

    return false;
  }

  // Secure cleanup of sensitive data
  static secureClearSensitiveData(obj: any): void {
    if (typeof obj === 'object' && obj !== null) {
      const sensitiveFields = ['password', 'token', 'key', 'secret'];
      
      for (const field of sensitiveFields) {
        if (field in obj) {
          obj[field] = null;
          delete obj[field];
        }
      }
    }
  }
}
