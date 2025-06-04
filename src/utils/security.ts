
// Centralized security utilities for input validation and sanitization

export class SecurityUtils {
  // Enhanced email validation
  static isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(email)) return false;
    if (email.length > 254) return false;
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\./,  // Double dots
      /^\./, // Starting with dot
      /\.$/, // Ending with dot
    ];
    
    return !suspiciousPatterns.some(pattern => pattern.test(email));
  }

  // Basic email validation (legacy method)
  static isValidBasicEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Enhanced UUID validation
  static isValidUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Basic UUID validation (legacy method)
  static isValidBasicUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    return uuidRegex.test(uuid);
  }

  // Enhanced input sanitization
  static sanitizeUserInput(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .trim()
      .slice(0, 1000)
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, ''); // Remove event handlers
  }

  // Basic input sanitization (legacy method)
  static sanitizeBasicUserInput(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Password strength validation
  static isStrongPassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!password || typeof password !== 'string') {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password is too long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[^a-zA-Z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Check for SQL injection patterns
  static containsSQLInjection(input: string): boolean {
    if (!input || typeof input !== 'string') return false;
    
    const sqlPatterns = [
      /('|(\\')|(--;)|(\s*(=|;|\||,)\s*('|"|\\|\/\*))/i,
      /(union|select|insert|delete|update|drop|create|alter|exec|execute)/i,
      /(\s|^)(or|and)\s+\w+\s*(=|like|in)\s*/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  // Check for XSS patterns
  static containsXSS(input: string): boolean {
    if (!input || typeof input !== 'string') return false;
    
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  }

  // Validate file upload
  static validateFileUpload(file: File, allowedTypes: string[], maxSizeMB: number = 10): { isValid: boolean; error?: string } {
    if (!file) {
      return { isValid: false, error: 'File is required' };
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return { isValid: false, error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` };
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { isValid: false, error: `File size must be less than ${maxSizeMB}MB` };
    }

    // Check file name for suspicious patterns
    if (this.containsXSS(file.name) || this.containsSQLInjection(file.name)) {
      return { isValid: false, error: 'File name contains suspicious content' };
    }

    return { isValid: true };
  }

  // Create rate limiter function
  static createRateLimiter(maxRequests: number, windowMs: number) {
    const attempts = new Map<string, { count: number; resetTime: number }>();

    return (identifier: string): boolean => {
      const now = Date.now();
      const record = attempts.get(identifier);

      if (!record || now > record.resetTime) {
        attempts.set(identifier, { count: 1, resetTime: now + windowMs });
        return true;
      }

      if (record.count >= maxRequests) {
        return false;
      }

      record.count++;
      return true;
    };
  }
}

// Content Security Policy header
export const getCSPHeader = (): string => {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://*.supabase.io",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://*.supabase.co https://*.supabase.io blob:",
    "connect-src 'self' https://*.supabase.co https://*.supabase.io wss://*.supabase.co wss://*.supabase.io",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
};
