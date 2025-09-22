// Enhanced input validation with security focus
import { EnhancedSecurityLogger } from './enhancedSecurityLogger';

export interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: any;
  errors: string[];
  securityFlags: string[];
}

export class EnhancedInputValidator {
  private static readonly DANGEROUS_PATTERNS = [
    // XSS patterns
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /expression\s*\(/gi,
    
    // SQL injection patterns
    /(union|select|insert|update|delete|drop|create|alter|exec|execute)\s+/gi,
    /(\w+\s*=\s*\w+|\w+\s+like\s+)/gi,
    /(--|\#|\/\*|\*\/)/g,
    
    // Command injection patterns
    /(\||\&|\;|\`|\$\()/g,
    /(wget|curl|nc|netcat|bash|sh|cmd|powershell)/gi,
    
    // Path traversal patterns
    /\.\.\//g,
    /\.\.\\/g,
    
    // LDAP injection patterns
    /[\(\)\*\|&=!<>~]/g
  ];

  private static readonly SUSPICIOUS_CHARS = [
    '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07',
    '\x08', '\x0B', '\x0C', '\x0E', '\x0F', '\x10', '\x11', '\x12',
    '\x13', '\x14', '\x15', '\x16', '\x17', '\x18', '\x19', '\x1A',
    '\x1B', '\x1C', '\x1D', '\x1E', '\x1F', '\x7F'
  ];

  static async validateAndSanitize(
    input: any, 
    type: 'string' | 'email' | 'url' | 'html' | 'number' | 'boolean',
    options: {
      maxLength?: number;
      allowEmpty?: boolean;
      strictMode?: boolean;
    } = {}
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      securityFlags: []
    };

    try {
      // Handle null/undefined
      if (input === null || input === undefined) {
        if (options.allowEmpty) {
          result.sanitizedValue = input;
          return result;
        } else {
          result.isValid = false;
          result.errors.push('Input cannot be null or undefined');
          return result;
        }
      }

      // Type-specific validation
      switch (type) {
        case 'string':
          return await this.validateString(input, options);
        case 'email':
          return await this.validateEmail(input, options);
        case 'url':
          return await this.validateURL(input, options);
        case 'html':
          return await this.validateHTML(input, options);
        case 'number':
          return await this.validateNumber(input, options);
        case 'boolean':
          return await this.validateBoolean(input, options);
        default:
          result.isValid = false;
          result.errors.push(`Unknown validation type: ${type}`);
          return result;
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push('Validation failed due to internal error');
      result.securityFlags.push('validation_error');
      
      await EnhancedSecurityLogger.logSystemEvent('input_validation_error', 'medium', {
        error: error instanceof Error ? error.message : 'Unknown error',
        input: typeof input === 'string' ? input.substring(0, 100) : typeof input,
        type
      });
      
      return result;
    }
  }

  private static async validateString(input: any, options: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      securityFlags: []
    };

    if (typeof input !== 'string') {
      input = String(input);
      result.securityFlags.push('type_coercion');
    }

    // Check for suspicious characters
    for (const char of this.SUSPICIOUS_CHARS) {
      if (input.includes(char)) {
        result.securityFlags.push('suspicious_characters');
        await EnhancedSecurityLogger.logSuspiciousActivity('malicious_characters_detected', {
          input: input.substring(0, 100)
        });
        break;
      }
    }

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        result.securityFlags.push('dangerous_pattern');
        result.isValid = false;
        result.errors.push('Input contains potentially dangerous content');
        
        await EnhancedSecurityLogger.logSuspiciousActivity('dangerous_pattern_detected', {
          pattern: pattern.source,
          input: input.substring(0, 100)
        });
        break;
      }
    }

    // Length validation
    if (options.maxLength && input.length > options.maxLength) {
      result.isValid = false;
      result.errors.push(`Input exceeds maximum length of ${options.maxLength}`);
    }

    // Sanitize if valid
    if (result.isValid) {
      result.sanitizedValue = this.sanitizeString(input, options.strictMode);
    }

    return result;
  }

  private static async validateEmail(input: any, options: any): Promise<ValidationResult> {
    const stringResult = await this.validateString(input, options);
    
    if (!stringResult.isValid) {
      return stringResult;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const email = stringResult.sanitizedValue as string;

    if (!emailRegex.test(email)) {
      stringResult.isValid = false;
      stringResult.errors.push('Invalid email format');
    }

    // Check for email-specific security issues
    if (email.length > 320) { // RFC 5321 limit
      stringResult.isValid = false;
      stringResult.errors.push('Email address too long');
    }

    return stringResult;
  }

  private static async validateURL(input: any, options: any): Promise<ValidationResult> {
    const stringResult = await this.validateString(input, options);
    
    if (!stringResult.isValid) {
      return stringResult;
    }

    try {
      const url = new URL(stringResult.sanitizedValue as string);
      
      // Security checks for URLs
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        stringResult.securityFlags.push('suspicious_protocol');
        await EnhancedSecurityLogger.logSuspiciousActivity('suspicious_url_protocol', {
          protocol: url.protocol,
          url: stringResult.sanitizedValue
        });
      }

      stringResult.sanitizedValue = url.toString();
    } catch {
      stringResult.isValid = false;
      stringResult.errors.push('Invalid URL format');
    }

    return stringResult;
  }

  private static async validateHTML(input: any, options: any): Promise<ValidationResult> {
    const stringResult = await this.validateString(input, { ...options, strictMode: true });
    
    if (!stringResult.isValid) {
      return stringResult;
    }

    // Additional HTML-specific validation
    const htmlString = stringResult.sanitizedValue as string;
    
    // Check for script tags and event handlers more strictly
    if (/<script|javascript:|on\w+=/gi.test(htmlString)) {
      stringResult.isValid = false;
      stringResult.errors.push('HTML contains potentially dangerous elements');
      stringResult.securityFlags.push('html_xss_attempt');
      
      await EnhancedSecurityLogger.logSuspiciousActivity('html_xss_attempt', {
        input: htmlString.substring(0, 200)
      });
    }

    return stringResult;
  }

  private static async validateNumber(input: any, options: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      securityFlags: []
    };

    const num = Number(input);
    
    if (isNaN(num)) {
      result.isValid = false;
      result.errors.push('Invalid number format');
    } else {
      result.sanitizedValue = num;
    }

    return result;
  }

  private static async validateBoolean(input: any, options: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      securityFlags: []
    };

    if (typeof input === 'boolean') {
      result.sanitizedValue = input;
    } else if (typeof input === 'string') {
      const lower = input.toLowerCase();
      if (lower === 'true' || lower === '1') {
        result.sanitizedValue = true;
      } else if (lower === 'false' || lower === '0') {
        result.sanitizedValue = false;
      } else {
        result.isValid = false;
        result.errors.push('Invalid boolean format');
      }
    } else {
      result.sanitizedValue = Boolean(input);
      result.securityFlags.push('type_coercion');
    }

    return result;
  }

  private static sanitizeString(input: string, strictMode: boolean = false): string {
    let sanitized = input;

    // Basic HTML entity encoding
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    if (strictMode) {
      // Remove all potentially dangerous characters in strict mode
      sanitized = sanitized.replace(/[^\w\s\-_.@]/g, '');
    }

    return sanitized.trim();
  }
}