// Content Security Policy configuration
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for React development
    "'unsafe-eval'", // Required for development builds
    "https://www.paypal.com",
    "https://www.sandbox.paypal.com",
    "https://js.paypal.com",
    "https://c.paypal.com"
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for CSS-in-JS and Tailwind
    "https://fonts.googleapis.com"
  ],
  'font-src': [
    "'self'",
    "https://fonts.gstatic.com",
    "data:"
  ],
  'img-src': [
    "'self'",
    "data:",
    "blob:",
    "https:",
    "https://fxkqgjakbyrxkmevkglv.supabase.co" // Supabase storage
  ],
  'connect-src': [
    "'self'",
    "https://fxkqgjakbyrxkmevkglv.supabase.co", // Supabase API
    "https://api.paypal.com",
    "https://api.sandbox.paypal.com",
    "wss://fxkqgjakbyrxkmevkglv.supabase.co" // Supabase realtime
  ],
  'frame-src': [
    "'self'",
    "https://www.paypal.com",
    "https://www.sandbox.paypal.com"
  ],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"], // Allow self-embedding but prevent external frames
  'upgrade-insecure-requests': []
};

// Convert CSP directives to string
function buildCSPString(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(' ')}`;
    })
    .join('; ');
}

// Security headers configuration
export class SecurityHeaders {
  static initialize() {
    // Apply CSP via meta tag (backup method)
    this.applyCSPMetaTag();
    
    // Apply other security measures
    this.preventClickjacking();
    this.disableCache();
    this.secureReferrer();
  }

  private static applyCSPMetaTag() {
    // Check if CSP meta tag already exists
    const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existingCSP) return;

    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = buildCSPString();
    document.head.appendChild(meta);
  }

  private static preventClickjacking() {
    // Check if we're in a trusted frame (Lovable preview)
    if (window.self === window.top) {
      return; // Not in a frame, no action needed
    }
    
    try {
      // Trusted domains for iframe embedding
      const trustedDomains = [
        'lovable.dev',
        'lovableproject.com', 
        'app.lovable.dev',
        'preview.lovable.dev'
      ];
      
      // Try to access parent location
      const parentOrigin = window.parent.location.hostname;
      const isTrustedFrame = trustedDomains.some(domain => 
        parentOrigin.includes(domain)
      );
      
      if (!isTrustedFrame) {
        console.warn('Application loaded in untrusted iframe - potential clickjacking attempt');
      }
    } catch (e) {
      // Cross-origin access blocked - allow in development
      if (!import.meta.env.DEV) {
        console.warn('Application loaded in cross-origin iframe');
      }
    }
  }

  private static disableCache() {
    // Disable cache for sensitive pages
    const sensitiveRoutes = ['/admin', '/dashboard'];
    const currentPath = window.location.pathname;
    
    if (sensitiveRoutes.some(route => currentPath.startsWith(route))) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Cache-Control';
      meta.content = 'no-cache, no-store, must-revalidate';
      document.head.appendChild(meta);
    }
  }

  private static secureReferrer() {
    // Set referrer policy
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'strict-origin-when-cross-origin';
    document.head.appendChild(meta);
  }

  // Rate limiting for admin routes
  static createRateLimiter(maxAttempts: number = 10, windowMs: number = 60000) {
    const attempts = new Map<string, { count: number; resetTime: number }>();

    return {
      isAllowed: (userId: string): boolean => {
        const now = Date.now();
        const userAttempts = attempts.get(userId);

        if (!userAttempts || now > userAttempts.resetTime) {
          attempts.set(userId, { count: 1, resetTime: now + windowMs });
          return true;
        }

        if (userAttempts.count >= maxAttempts) {
          return false;
        }

        userAttempts.count++;
        return true;
      },
      getRemainingAttempts: (userId: string): number => {
        const userAttempts = attempts.get(userId);
        if (!userAttempts || Date.now() > userAttempts.resetTime) {
          return maxAttempts;
        }
        return Math.max(0, maxAttempts - userAttempts.count);
      }
    };
  }
}