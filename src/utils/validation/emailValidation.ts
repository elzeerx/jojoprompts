
// Email validation utilities
export class EmailValidator {
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
}
