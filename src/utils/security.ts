
// Centralized security utilities for input validation and sanitization
import { EmailValidator } from './validation/emailValidation';
import { UUIDValidator } from './validation/uuidValidation';
import { PasswordValidator } from './validation/passwordValidation';
import { InputSanitizer } from './sanitization/inputSanitizer';
import { ThreatDetector } from './security/threatDetection';
import { FileValidator } from './fileValidation/fileValidator';
import { RateLimiterFactory } from './rateLimiting/rateLimiterFactory';

export class SecurityUtils {
  // Enhanced email validation
  static isValidEmail(email: string): boolean {
    return EmailValidator.isValidEmail(email);
  }

  // Basic email validation (legacy method)
  static isValidBasicEmail(email: string): boolean {
    return EmailValidator.isValidBasicEmail(email);
  }

  // Enhanced UUID validation
  static isValidUUID(uuid: string): boolean {
    return UUIDValidator.isValidUUID(uuid);
  }

  // Basic UUID validation (legacy method)
  static isValidBasicUUID(uuid: string): boolean {
    return UUIDValidator.isValidBasicUUID(uuid);
  }

  // Enhanced input sanitization
  static sanitizeUserInput(input: string): string {
    return InputSanitizer.sanitizeUserInput(input);
  }

  // Basic input sanitization (legacy method)
  static sanitizeBasicUserInput(input: string): string {
    return InputSanitizer.sanitizeBasicUserInput(input);
  }

  // Password strength validation
  static isStrongPassword(password: string): { isValid: boolean; errors: string[] } {
    return PasswordValidator.isStrongPassword(password);
  }

  // Check for SQL injection patterns
  static containsSQLInjection(input: string): boolean {
    return ThreatDetector.containsSQLInjection(input);
  }

  // Check for XSS patterns
  static containsXSS(input: string): boolean {
    return ThreatDetector.containsXSS(input);
  }

  // Validate file upload
  static validateFileUpload(file: File, allowedTypes: string[], maxSizeMB: number = 10): { isValid: boolean; error?: string } {
    // Check file name for suspicious patterns
    if (this.containsXSS(file.name) || this.containsSQLInjection(file.name)) {
      return { isValid: false, error: 'File name contains suspicious content' };
    }

    return FileValidator.validateFileUpload(file, allowedTypes, maxSizeMB);
  }

  // Create rate limiter function
  static createRateLimiter(maxRequests: number, windowMs: number) {
    return RateLimiterFactory.createRateLimiter(maxRequests, windowMs);
  }
}

// Content Security Policy header with frame-ancestors protection
export const getCSPHeader = (): string => {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://*.supabase.io",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://*.supabase.co https://*.supabase.io blob:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.io wss://*.supabase.co wss://*.supabase.io https://api.jojoprompts.com",
    "frame-src 'none'",
    "frame-ancestors 'self'", // Replace X-Frame-Options functionality
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
};
