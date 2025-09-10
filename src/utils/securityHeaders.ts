
import { getCSPHeader } from "./security";
import { createLogger } from "./logging";

// Apply security headers to the application
export const applySecurityHeaders = (): void => {
  // Content Security Policy
  const cspMeta = document.createElement('meta');
  cspMeta.httpEquiv = 'Content-Security-Policy';
  cspMeta.content = getCSPHeader();
  document.head.appendChild(cspMeta);

  // X-Frame-Options
  const frameMeta = document.createElement('meta');
  frameMeta.httpEquiv = 'X-Frame-Options';
  frameMeta.content = 'DENY';
  document.head.appendChild(frameMeta);

  // X-Content-Type-Options
  const contentTypeMeta = document.createElement('meta');
  contentTypeMeta.httpEquiv = 'X-Content-Type-Options';
  contentTypeMeta.content = 'nosniff';
  document.head.appendChild(contentTypeMeta);

  // Referrer Policy
  const referrerMeta = document.createElement('meta');
  referrerMeta.name = 'referrer';
  referrerMeta.content = 'strict-origin-when-cross-origin';
  document.head.appendChild(referrerMeta);

  // Permissions Policy
  const permissionsMeta = document.createElement('meta');
  permissionsMeta.httpEquiv = 'Permissions-Policy';
  permissionsMeta.content = 'camera=(), microphone=(), geolocation=()';
  document.head.appendChild(permissionsMeta);
};

// Initialize security headers when the app loads
export const initializeSecurity = (): void => {
  const logger = createLogger('SECURITY');
  
  // Apply security headers
  applySecurityHeaders();

  // Disable right-click context menu in production
  if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Disable F12 and other developer tools shortcuts in production
  if (import.meta.env.PROD) {
    document.addEventListener('keydown', (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.shiftKey && e.key === 'C') ||
        (e.ctrlKey && e.shiftKey && e.key === 'J') ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        return false;
      }
    });
  }

  // Log initialization
  logger.info('Security measures initialized');
};
