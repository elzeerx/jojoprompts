
// Security threat detection utilities
export class ThreatDetector {
  // SQL injection pattern detection
  static containsSQLInjection(input: string): boolean {
    if (!input || typeof input !== 'string') return false;
    
    const sqlPatterns = [
      /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
      /('|(\\)|(;)|(--)|(\|\|)|(\/\*)|(\*\/))/,
      /(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/i,
      /\bEXEC\b|\bEXECUTE\b/i,
      /\bSCRIPT\b/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  // XSS pattern detection
  static containsXSS(input: string): boolean {
    if (!input || typeof input !== 'string') return false;
    
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]+src[\\s]*=[\\s]*[\\"\\']*javascript:/gi,
      /<[^>]*on\w+\s*=.*>/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  }

  // Detect suspicious file uploads
  static isSuspiciousFile(filename: string): boolean {
    if (!filename || typeof filename !== 'string') return true;
    
    const suspiciousExtensions = [
      '.exe', '.bat', '.cmd', '.scr', '.pif', '.com',
      '.js', '.vbs', '.ps1', '.sh', '.php', '.asp', '.aspx'
    ];
    
    const lowercaseFilename = filename.toLowerCase();
    return suspiciousExtensions.some(ext => lowercaseFilename.endsWith(ext));
  }

  // Detect suspicious URLs
  static isSuspiciousURL(url: string): boolean {
    if (!url || typeof url !== 'string') return true;
    
    try {
      const parsedUrl = new URL(url);
      
      // Check for suspicious protocols
      const suspiciousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
      if (suspiciousProtocols.includes(parsedUrl.protocol)) {
        return true;
      }
      
      // Check for suspicious domains
      const suspiciousDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
      if (suspiciousDomains.includes(parsedUrl.hostname)) {
        return true;
      }
      
      return false;
    } catch {
      return true; // Invalid URL
    }
  }
}
