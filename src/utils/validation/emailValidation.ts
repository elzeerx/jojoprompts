// Email validation utilities
export class EmailValidator {
  // Enhanced email validation
  static isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(trimmed) && trimmed.length <= 320;
  }

  // Basic email validation (legacy method)
  static isValidBasicEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    return email.includes('@') && email.includes('.');
  }
}