
// Security threat detection utilities
export class ThreatDetector {
  // Check for SQL injection patterns
  static containsSQLInjection(input: string): boolean {
    if (!input || typeof input !== 'string') return false;
    
    const sqlPatterns = [
      /('|(\\')|(--;)|(\s*(=|;|\||,)\s*('|"|\\|\/\*)))/i,
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
}
