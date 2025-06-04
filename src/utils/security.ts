// Centralized security utilities for input validation and sanitization

export class SecurityUtils {
  // Basic email validation
  static isValidBasicEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Basic UUID validation
  static isValidBasicUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    return uuidRegex.test(uuid);
  }

  // Sanitize user input to prevent XSS attacks
  static sanitizeBasicUserInput(input: string): string {
    if (!input || typeof input !== 'string') return '';
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

// Enhanced SecurityUtils with new validation methods
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

  // Enhanced UUID validation
  static isValidUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
}
