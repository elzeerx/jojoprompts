
import { RequestValidationResult } from './types.ts';

// Enhanced request validation with security focus
export function validateAdminRequest(req: Request): RequestValidationResult {
  try {
    // Enhanced method validation
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    if (!allowedMethods.includes(req.method)) {
      return { isValid: false, error: 'Invalid request method' };
    }

    // Enhanced content type validation
    if (['POST', 'PUT'].includes(req.method)) {
      const contentType = req.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return { isValid: false, error: 'Invalid content type - application/json required' };
      }
    }

    // Enhanced header validation
    const requiredHeaders = ['authorization'];
    for (const header of requiredHeaders) {
      const headerValue = req.headers.get(header);
      if (!headerValue) {
        return { isValid: false, error: `Missing required header: ${header}` };
      }
      
      // Additional header value validation
      if (header === 'authorization') {
        if (!headerValue.startsWith('Bearer ') || headerValue.length < 20) {
          return { isValid: false, error: 'Invalid authorization header format' };
        }
      }
    }

    // Enhanced user agent validation
    const userAgent = req.headers.get('user-agent');
    if (!userAgent || userAgent.length < 5 || userAgent.length > 500) {
      return { isValid: false, error: 'Invalid or suspicious user agent' };
    }

    // Check for suspicious patterns in headers
    const suspiciousPatterns = [
      /script/i, /javascript/i, /vbscript/i, /<[^>]*>/,
      /union.*select/i, /drop.*table/i, /exec\(/i
    ];

    for (const [headerName, headerValue] of req.headers.entries()) {
      if (typeof headerValue === 'string') {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(headerValue)) {
            console.warn('Suspicious header content detected', { headerName, pattern: pattern.toString() });
            return { isValid: false, error: 'Suspicious request content detected' };
          }
        }
      }
    }

    // URL validation
    const url = new URL(req.url);
    if (url.pathname.includes('..') || url.pathname.includes('%')) {
      return { isValid: false, error: 'Invalid URL path' };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Request validation error:', error);
    return { isValid: false, error: 'Request validation failed' };
  }
}
