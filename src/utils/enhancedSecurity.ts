
// Enhanced security utilities with improved validation and monitoring

import { InputValidator } from './inputValidation';
import { enhancedRateLimiter, EnhancedRateLimitConfigs } from './enhancedRateLimiting';
import { logWarn, logError, logInfo } from './secureLogging';
import { securityMonitor } from './monitoring';
import { EnhancedSecurityLogger } from './security/enhancedSecurityLogger';
import { EnhancedInputValidator } from './security/enhancedInputValidation';
import { SecurityUtils } from './security';

export class SecurityEnforcer {
  // Enhanced authentication attempt logging with IP tracking
  static logAuthAttempt(
    action: 'login' | 'signup' | 'password_reset',
    email: string,
    success: boolean,
    error?: string,
    metadata?: Record<string, any>
  ): void {
    const category = 'auth_security';
    
    // Enhanced logging with additional context
    const logData = {
      action,
      success,
      error,
      userAgent: navigator?.userAgent?.substring(0, 200), // Limit length
      timestamp: new Date().toISOString(),
      ...metadata
    };
    
    if (success) {
      logInfo(`${action} successful`, category, logData);
    } else {
      logError(`${action} failed`, category, logData);
      
      // Enhanced security monitoring for failed attempts
      securityMonitor.logEvent('auth_failure', {
        action,
        domain: email.split('@')[1],
        error: error?.substring(0, 100) // Limit error message length
      });
      
      // Record failed attempt for enhanced rate limiting
      const key = `${action}_${email}`;
      enhancedRateLimiter.recordFailedAttempt(key, { action, error });
    }
  }

  // Enhanced rate limiting with progressive delays
  static checkAuthRateLimit(
    action: 'login' | 'signup' | 'password_reset',
    email: string
  ): { allowed: boolean; retryAfter?: number; attemptsLeft?: number } {
    if (!email || typeof email !== 'string') {
      logWarn('Invalid email provided for rate limit check', 'security');
      return { allowed: false, retryAfter: 300 }; // 5 minutes for invalid input
    }
    
    const key = `${action}_${email}`;
    
    let config;
    switch (action) {
      case 'login':
        config = EnhancedRateLimitConfigs.AUTH_LOGIN;
        break;
      case 'signup':
        config = EnhancedRateLimitConfigs.AUTH_SIGNUP;
        break;
      case 'password_reset':
        config = EnhancedRateLimitConfigs.PASSWORD_RESET;
        break;
      default:
        config = EnhancedRateLimitConfigs.API_CALL;
    }

    const result = enhancedRateLimiter.isAllowed(key, config);
    
    // Log rate limit violations
    if (!result.allowed) {
      logWarn('Rate limit exceeded', 'security', { action, email: email.split('@')[1] });
      securityMonitor.logEvent('rate_limit', { action, email: email.split('@')[1] });
    }
    
    return result;
  }

  // Enhanced input validation with comprehensive security checks
  static async validateUserInput(data: {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    [key: string]: any;
  }): Promise<{ isValid: boolean; errors: string[]; sanitizedData: Record<string, any>; securityFlags: string[] }> {
    const errors: string[] = [];
    const securityFlags: string[] = [];
    const sanitizedData: Record<string, any> = {};

    try {
      // Use enhanced input validation for each field
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) continue;

        let validationType: 'string' | 'email' | 'url' | 'html' | 'number' | 'boolean' = 'string';
        
        if (key === 'email') {
          validationType = 'email';
        } else if (key.includes('url') || key.includes('link')) {
          validationType = 'url';
        } else if (key === 'password') {
          // Handle password separately for strength validation
          if (!SecurityUtils.isStrongPassword(value as string)) {
            errors.push('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
          }
          continue; // Don't sanitize passwords
        }

        const validationResult = await EnhancedInputValidator.validateAndSanitize(
          value,
          validationType,
          { maxLength: 500, strictMode: true }
        );

        if (!validationResult.isValid) {
          errors.push(...validationResult.errors);
        }

        if (validationResult.securityFlags.length > 0) {
          securityFlags.push(...validationResult.securityFlags);
        }

        if (validationResult.sanitizedValue !== undefined) {
          sanitizedData[key] = validationResult.sanitizedValue;
        }
      }

      // Log security events if threats detected
      if (securityFlags.length > 0) {
        await EnhancedSecurityLogger.logSuspiciousActivity(
          'input_validation_threats_detected',
          { securityFlags, sanitizedFields: Object.keys(sanitizedData) }
        );
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData,
        securityFlags
      };
    } catch (error) {
      logError('Input validation error', 'security', { error: String(error) });
      await EnhancedSecurityLogger.logSystemEvent('input_validation_error', 'medium', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        isValid: false,
        errors: ['Validation failed'],
        sanitizedData: {},
        securityFlags: ['validation_error']
      };
    }
  }

  // Enhanced security ID generation
  static generateSecureId(): string {
    try {
      const array = new Uint8Array(32); // Increased entropy
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      logError('Error generating secure ID', 'security', { error: String(error) });
      // Fallback to timestamp-based ID (less secure but functional)
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
  }

  // Enhanced suspicious activity detection
  static detectSuspiciousActivity(
    action: string,
    metadata: Record<string, any> = {}
  ): boolean {
    try {
      // Enhanced pattern detection
      const suspiciousPatterns = [
        'user_deletion',
        'rapid_login_attempts',
        'payment_manipulation',
        'privilege_escalation'
      ];

      if (suspiciousPatterns.includes(action)) {
        const rapidActionKey = `suspicious_${action}`;
        const rapidCheck = enhancedRateLimiter.isAllowed(rapidActionKey, {
          maxAttempts: 5,
          windowMs: 5 * 60 * 1000, // 5 minutes
          blockDurationMs: 15 * 60 * 1000 // 15 minutes
        });

        if (!rapidCheck.allowed) {
          logWarn('Suspicious rapid activity detected', 'security', {
            action,
            blockedFor: rapidCheck.retryAfter,
            ...metadata
          });
          
          securityMonitor.logEvent('suspicious_activity', {
            action,
            pattern: 'rapid_attempts',
            ...metadata
          });
          
          return true;
        }
      }

      // Additional pattern checks
      if (metadata.consecutiveFailures && metadata.consecutiveFailures > 10) {
        logWarn('Excessive consecutive failures detected', 'security', { action, ...metadata });
        return true;
      }

      return false;
    } catch (error) {
      logError('Error in suspicious activity detection', 'security', { error: String(error) });
      return false; // Don't block on detection errors
    }
  }

  // Enhanced secure data cleanup
  static secureClearSensitiveData(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    
    try {
      const sensitiveFields = [
        'password', 'token', 'key', 'secret', 'apiKey', 'api_key',
        'accessToken', 'access_token', 'refreshToken', 'refresh_token',
        'sessionId', 'session_id', 'creditCard', 'credit_card',
        'ssn', 'socialSecurityNumber', 'bankAccount', 'bank_account'
      ];
      
      const clearField = (object: any, field: string) => {
        if (field in object) {
          if (typeof object[field] === 'string') {
            object[field] = '*'.repeat(Math.min(object[field].length, 8));
          }
          delete object[field];
        }
      };
      
      // Clear sensitive fields recursively
      const clearSensitiveFields = (target: any, depth = 0) => {
        if (depth > 3 || !target || typeof target !== 'object') return; // Prevent deep recursion
        
        for (const field of sensitiveFields) {
          clearField(target, field);
        }
        
        // Recursively clear nested objects
        Object.keys(target).forEach(key => {
          if (target[key] && typeof target[key] === 'object') {
            clearSensitiveFields(target[key], depth + 1);
          }
        });
      };
      
      clearSensitiveFields(obj);
    } catch (error) {
      logError('Error clearing sensitive data', 'security', { error: String(error) });
    }
  }

  // Helper method to check for suspicious content
  private static containsSuspiciousContent(input: string): boolean {
    if (!input || typeof input !== 'string') return false;
    
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
      /vbscript:/i,
      /(union|select|insert|delete|update|drop|create|alter)\s+/i,
      /[<>'"]/g.test(input) && input.includes('='), // Potential XSS
    ];
    
    return suspiciousPatterns.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(input);
      }
      return false;
    });
  }

  // Enhanced session validation
  static validateSessionIntegrity(session: any): boolean {
    if (!session || typeof session !== 'object') {
      return false;
    }

    try {
      // Check required session fields
      const requiredFields = ['access_token', 'user', 'expires_at'];
      for (const field of requiredFields) {
        if (!session[field]) {
          logWarn('Session missing required field', 'security', { field });
          return false;
        }
      }

      // Check session expiration
      if (session.expires_at) {
        const expiresAt = new Date(session.expires_at * 1000);
        const now = new Date();
        if (now >= expiresAt) {
          logWarn('Session expired', 'security');
          return false;
        }
      }

      // Validate user object
      if (!session.user?.id || typeof session.user.id !== 'string') {
        logWarn('Session has invalid user ID', 'security');
        return false;
      }

      return true;
    } catch (error) {
      logError('Error validating session integrity', 'security', { error: String(error) });
      return false;
    }
  }

  // IP-based security validation
  static validateRequestOrigin(request?: Request): boolean {
    // This would typically check IP whitelist, geolocation, etc.
    // For now, we'll implement basic validation
    try {
      if (!request) return true; // Allow if no request object
      
      const userAgent = request.headers.get('user-agent');
      if (!userAgent || userAgent.length < 10) {
        logWarn('Suspicious request with minimal user agent', 'security', { userAgent });
        return false;
      }

      // Add more sophisticated checks as needed
      return true;
    } catch (error) {
      logError('Error validating request origin', 'security', { error: String(error) });
      return true; // Allow on error to prevent blocking legitimate users
    }
  }
}
