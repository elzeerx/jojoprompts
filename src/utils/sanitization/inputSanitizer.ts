
// Input sanitization utilities
export class InputSanitizer {
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
}
