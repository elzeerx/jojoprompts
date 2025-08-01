import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { securityLogger } from "@/utils/security/securityLogger";
import { EnhancedSessionValidator } from "@/utils/security/enhancedSessionValidator";
import { SecurityHeaders } from "@/utils/security/securityHeaders";

interface SecurityMonitoringOptions {
  enableRouteMonitoring?: boolean;
  enableSessionValidation?: boolean;
  enableRateLimit?: boolean;
  rateLimitConfig?: {
    maxAttempts: number;
    windowMs: number;
  };
}

export function useSecurityMonitoring(options: SecurityMonitoringOptions = {}) {
  const { user, userRole } = useAuth();
  const location = useLocation();
  const rateLimiter = useRef<any>(null);
  const sessionValidator = useRef<any>(null);

  const {
    enableRouteMonitoring = true,
    enableSessionValidation = true,
    enableRateLimit = true,
    rateLimitConfig = { maxAttempts: 10, windowMs: 60000 }
  } = options;

  // Initialize security monitoring
  useEffect(() => {
    // Initialize security headers
    SecurityHeaders.initialize();

    // Initialize rate limiter for admin routes
    if (enableRateLimit) {
      rateLimiter.current = SecurityHeaders.createRateLimiter(
        rateLimitConfig.maxAttempts,
        rateLimitConfig.windowMs
      );
    }

    // Set up session validation interval
    if (enableSessionValidation) {
      sessionValidator.current = setInterval(async () => {
        if (user) {
          const result = await EnhancedSessionValidator.validateSession(user.id);
          
          if (!result.isValid) {
            securityLogger.logSecurityEvent({
              action: 'session_validation_failed',
              userId: user.id,
              details: { reason: result.reason }
            });
          }

          if (result.securityFlags && result.securityFlags.length > 0) {
            securityLogger.logSecurityEvent({
              action: 'security_flags_detected',
              userId: user.id,
              details: { flags: result.securityFlags }
            });
          }
        }
      }, 5 * 60 * 1000); // Every 5 minutes
    }

    return () => {
      if (sessionValidator.current) {
        clearInterval(sessionValidator.current);
      }
    };
  }, [user, enableRateLimit, enableSessionValidation, rateLimitConfig]);

  // Monitor route changes
  useEffect(() => {
    if (!enableRouteMonitoring) return;

    const currentPath = location.pathname;
    
    // Check if this is a protected route
    const protectedRoutes = ['/admin', '/dashboard', '/prompter'];
    const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));
    
    if (isProtectedRoute && user) {
      // Check rate limiting for admin routes
      if (currentPath.startsWith('/admin') && rateLimiter.current) {
        const isAllowed = rateLimiter.current.isAllowed(user.id);
        
        if (!isAllowed) {
          securityLogger.logRateLimitExceeded(
            user.id,
            currentPath,
            rateLimitConfig.maxAttempts
          );
          // Could redirect or show warning here
        }
      }

      // Log access to protected routes
      securityLogger.logRouteAccess({
        path: currentPath,
        userRole: userRole || 'unknown',
        userId: user.id
      });
    }

    // Monitor for suspicious navigation patterns
    const navigationCount = parseInt(localStorage.getItem('navigation_count') || '0');
    const lastNavigationTime = parseInt(localStorage.getItem('last_navigation_time') || '0');
    const now = Date.now();

    if (now - lastNavigationTime < 1000) { // Less than 1 second between navigations
      const newCount = navigationCount + 1;
      localStorage.setItem('navigation_count', newCount.toString());

      // Flag rapid navigation as suspicious
      if (newCount > 20) {
        securityLogger.logSuspiciousActivity(
          user?.id || 'anonymous',
          'Rapid navigation detected',
          { 
            navigationCount: newCount,
            currentPath,
            timeWindow: '1 second'
          }
        );
        localStorage.setItem('navigation_count', '0'); // Reset counter
      }
    } else {
      localStorage.setItem('navigation_count', '1');
    }

    localStorage.setItem('last_navigation_time', now.toString());
  }, [location.pathname, user, userRole, enableRouteMonitoring, rateLimitConfig]);

  // Monitor user interactions
  useEffect(() => {
    const handleSuspiciousEvents = () => {
      // Monitor for potential bot behavior
      let clickCount = 0;
      let rapidClicks = 0;

      const handleClick = () => {
        clickCount++;
        const now = Date.now();
        const lastClick = parseInt(localStorage.getItem('last_click_time') || '0');

        if (now - lastClick < 100) { // Clicks faster than 100ms
          rapidClicks++;
          if (rapidClicks > 10) {
            securityLogger.logSuspiciousActivity(
              user?.id || 'anonymous',
              'Rapid clicking detected - possible bot behavior',
              { rapidClicks, timeWindow: '100ms' }
            );
            rapidClicks = 0; // Reset counter
          }
        } else {
          rapidClicks = 0;
        }

        localStorage.setItem('last_click_time', now.toString());
      };

      // Monitor developer tools
      let devToolsOpen = false;
      const detectDevTools = () => {
        const threshold = 160;
        if (window.outerHeight - window.innerHeight > threshold ||
            window.outerWidth - window.innerWidth > threshold) {
          if (!devToolsOpen) {
            devToolsOpen = true;
            securityLogger.logSecurityEvent({
              action: 'developer_tools_opened',
              userId: user?.id,
              details: {
                path: location.pathname,
                timestamp: new Date().toISOString()
              }
            });
          }
        } else {
          devToolsOpen = false;
        }
      };

      document.addEventListener('click', handleClick);
      const devToolsInterval = setInterval(detectDevTools, 1000);

      return () => {
        document.removeEventListener('click', handleClick);
        clearInterval(devToolsInterval);
      };
    };

    const cleanup = handleSuspiciousEvents();
    return cleanup;
  }, [user, location.pathname]);

  return {
    getRemainingAttempts: (userId: string) => {
      return rateLimiter.current?.getRemainingAttempts(userId) || 0;
    },
    
    validateSession: async () => {
      if (user) {
        return await EnhancedSessionValidator.validateSession(user.id);
      }
      return { isValid: false, reason: 'No user' };
    },

    clearSecurityData: () => {
      EnhancedSessionValidator.clearSecurityData();
      localStorage.removeItem('navigation_count');
      localStorage.removeItem('last_navigation_time');
      localStorage.removeItem('last_click_time');
    }
  };
}