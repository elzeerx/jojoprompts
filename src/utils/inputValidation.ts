
// Enhanced input validation utilities with comprehensive security checks
import { SecurityUtils } from './security';

export class InputValidator {
  // Enhanced email validation with security checks
  static validateEmail(email: string): { isValid: boolean; error?: string } {
    if (!email || typeof email !== 'string') {
      return { isValid: false, error: 'Email is required and must be a string' };
    }

    // Trim and normalize
    const normalizedEmail = email.trim().toLowerCase();
    
    // Length checks
    if (normalizedEmail.length === 0) {
      return { isValid: false, error: 'Email cannot be empty' };
    }
    
    if (normalizedEmail.length > 320) { // RFC 5321 limit
      return { isValid: false, error: 'Email address is too long' };
    }

    // Enhanced email regex with security considerations
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(normalizedEmail)) {
      return { isValid: false, error: 'Invalid email format' };
    }

    // Check for suspicious patterns
    if (SecurityUtils.containsXSS(normalizedEmail) || SecurityUtils.containsSQLInjection(normalizedEmail)) {
      return { isValid: false, error: 'Email contains invalid characters' };
    }

    // Domain validation
    const [localPart, domain] = normalizedEmail.split('@');
    
    if (localPart.length > 64) { // RFC 5321 limit for local part
      return { isValid: false, error: 'Email local part is too long' };
    }
    
    if (domain.length > 253) { // RFC 5321 limit for domain
      return { isValid: false, error: 'Email domain is too long' };
    }

    // Check for consecutive dots
    if (normalizedEmail.includes('..')) {
      return { isValid: false, error: 'Email cannot contain consecutive dots' };
    }

    // Check for suspicious domains (could be expanded)
    const suspiciousDomains = ['tempmail.org', '10minutemail.com', 'guerrillamail.com'];
    if (suspiciousDomains.some(suspDomain => domain.includes(suspDomain))) {
      return { isValid: false, error: 'Temporary email addresses are not allowed' };
    }

    return { isValid: true };
  }

  // Enhanced password validation with comprehensive security checks
  static validatePassword(password: string): { isValid: boolean; error?: string } {
    if (!password || typeof password !== 'string') {
      return { isValid: false, error: 'Password is required and must be a string' };
    }

    // Length checks
    if (password.length < 8) {
      return { isValid: false, error: 'Password must be at least 8 characters long' };
    }

    if (password.length > 128) { // Reasonable upper limit
      return { isValid: false, error: 'Password is too long (max 128 characters)' };
    }

    // Character requirements
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const requirements = [];
    if (!hasLowerCase) requirements.push('lowercase letter');
    if (!hasUpperCase) requirements.push('uppercase letter');
    if (!hasNumbers) requirements.push('number');
    if (!hasSpecialChar) requirements.push('special character');

    if (requirements.length > 0) {
      return { 
        isValid: false, 
        error: `Password must contain at least one: ${requirements.join(', ')}` 
      };
    }

    // Security checks
    if (SecurityUtils.containsXSS(password) || SecurityUtils.containsSQLInjection(password)) {
      return { isValid: false, error: 'Password contains invalid characters' };
    }

    // Common password checks
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', '1234567890'
    ];
    
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      return { isValid: false, error: 'Password is too common' };
    }

    // Check for repeated characters
    if (/(.)\1{3,}/.test(password)) {
      return { isValid: false, error: 'Password cannot have more than 3 consecutive identical characters' };
    }

    return { isValid: true };
  }

  // Enhanced UUID validation
  static validateUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') {
      return false;
    }

    // Trim and check format
    const trimmedUuid = uuid.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    return uuidRegex.test(trimmedUuid);
  }

  // Enhanced text sanitization with security focus
  static sanitizeText(text: string, maxLength: number = 255): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let sanitized = text
      .trim()
      .slice(0, maxLength)
      // Remove potential HTML/script tags
      .replace(/<[^>]*>/g, '')
      // Remove javascript: protocols
      .replace(/javascript:/gi, '')
      // Remove event handlers
      .replace(/on\w+=/gi, '')
      // Remove null bytes
      .replace(/\0/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ');

    return sanitized;
  }

  // Enhanced phone number validation
  static validatePhoneNumber(phone: string): { isValid: boolean; error?: string } {
    if (!phone || typeof phone !== 'string') {
      return { isValid: false, error: 'Phone number is required' };
    }

    // Remove common formatting characters
    const cleanPhone = phone.replace(/[\s\-\(\)\+\.]/g, '');
    
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return { isValid: false, error: 'Phone number must be between 10-15 digits' };
    }

    if (!/^\d+$/.test(cleanPhone)) {
      return { isValid: false, error: 'Phone number must contain only digits' };
    }

    return { isValid: true };
  }

  // URL validation with security checks
  static validateURL(url: string): { isValid: boolean; error?: string } {
    if (!url || typeof url !== 'string') {
      return { isValid: false, error: 'URL is required' };
    }

    try {
      const urlObj = new URL(url);
      
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { isValid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
      }

      // Security checks
      if (SecurityUtils.containsXSS(url) || SecurityUtils.containsSQLInjection(url)) {
        return { isValid: false, error: 'URL contains invalid characters' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }

  // Generic object validation
  static validateObject(obj: any, requiredFields: string[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!obj || typeof obj !== 'object') {
      errors.push('Input must be a valid object');
      return { isValid: false, errors };
    }

    // Check required fields
    for (const field of requiredFields) {
      if (obj[field] === undefined || obj[field] === null) {
        errors.push(`Field '${field}' is required`);
      }
    }

    // Check for suspicious content in string fields
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        if (SecurityUtils.containsXSS(obj[key]) || SecurityUtils.containsSQLInjection(obj[key])) {
          errors.push(`Field '${key}' contains invalid content`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
