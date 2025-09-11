
import { getCSPHeader } from "./security";
import { createLogger } from "./logging";

// Apply security headers to the application
export const applySecurityHeaders = (): void => {
  // Content Security Policy
  const cspMeta = document.createElement('meta');
  cspMeta.httpEquiv = 'Content-Security-Policy';
  cspMeta.content = getCSPHeader();
  document.head.appendChild(cspMeta);

  // Skip X-Frame-Options meta tag - use CSP frame-ancestors instead

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

  // Remove anti-debugging features as they can break legitimate embedding

  // Log initialization
  logger.info('Security measures initialized');
};
