
// Comprehensive input validation utilities

export class InputValidator {
  // Email validation with stricter rules
  static validateEmail(email: string): { isValid: boolean; error?: string } {
    if (!email || typeof email !== 'string') {
      return { isValid: false, error: 'Email is required' };
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!emailRegex.test(email)) {
      return { isValid: false, error: 'Invalid email format' };
    }

    if (email.length > 254) {
      return { isValid: false, error: 'Email is too long' };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\./,  // Double dots
      /^\./, // Starting with dot
      /\.$/, // Ending with dot
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(email))) {
      return { isValid: false, error: 'Invalid email format' };
    }

    return { isValid: true };
  }

  // Password strength validation
  static validatePassword(password: string): { isValid: boolean; error?: string; strength: 'weak' | 'medium' | 'strong' } {
    if (!password || typeof password !== 'string') {
      return { isValid: false, error: 'Password is required', strength: 'weak' };
    }

    if (password.length < 8) {
      return { isValid: false, error: 'Password must be at least 8 characters long', strength: 'weak' };
    }

    if (password.length > 128) {
      return { isValid: false, error: 'Password is too long', strength: 'weak' };
    }

    // Check for common weak passwords
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
    if (commonPasswords.includes(password.toLowerCase())) {
      return { isValid: false, error: 'Password is too common', strength: 'weak' };
    }

    // Calculate strength
    let score = 0;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    if (password.length >= 12) score++;

    let strength: 'weak' | 'medium' | 'strong';
    if (score < 3) {
      strength = 'weak';
      return { isValid: false, error: 'Password is too weak. Use uppercase, lowercase, numbers, and symbols.', strength };
    } else if (score < 4) {
      strength = 'medium';
    } else {
      strength = 'strong';
    }

    return { isValid: true, strength };
  }

  // Text input sanitization
  static sanitizeText(input: string, maxLength = 1000): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, ''); // Remove event handlers
  }

  // Validate UUID format
  static validateUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Validate numeric input
  static validateNumber(value: any, min?: number, max?: number): { isValid: boolean; error?: string } {
    const num = Number(value);
    
    if (isNaN(num)) {
      return { isValid: false, error: 'Invalid number format' };
    }

    if (min !== undefined && num < min) {
      return { isValid: false, error: `Value must be at least ${min}` };
    }

    if (max !== undefined && num > max) {
      return { isValid: false, error: `Value must be at most ${max}` };
    }

    return { isValid: true };
  }

  // Validate URL format
  static validateURL(url: string): { isValid: boolean; error?: string } {
    if (!url || typeof url !== 'string') {
      return { isValid: false, error: 'URL is required' };
    }

    try {
      const parsedUrl = new URL(url);
      
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { isValid: false, error: 'Only HTTP and HTTPS URLs are allowed' };
      }

      return { isValid: true };
    } catch {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }

  // File validation
  static validateFile(file: File, allowedTypes: string[], maxSizeMB = 10): { isValid: boolean; error?: string } {
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

    return { isValid: true };
  }
}
