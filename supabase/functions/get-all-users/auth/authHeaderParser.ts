import { createEdgeLogger } from '../../_shared/logger.ts';

const logger = createEdgeLogger('get-all-users:auth:header-parser');

export interface AuthHeaderResult {
  token: string;
  isValid: boolean;
  error?: string;
}

/**
 * Extract and validate JWT from Authorization header
 */
export function parseAuthHeader(req: Request): AuthHeaderResult {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.error('Missing or invalid Authorization header format');
    return {
      token: '',
      isValid: false,
      error: 'Missing or invalid authorization header'
    };
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  
  if (!token || token.length < 10) {
    logger.error('Invalid token format or length');
    return {
      token: '',
      isValid: false,
      error: 'Invalid token format'
    };
  }

  return {
    token,
    isValid: true
  };
}
