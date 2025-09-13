
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import type { AuthContext } from '../../_shared/adminAuth.ts';
import { logSecurityEvent } from '../../_shared/adminAuth.ts';
import { validateEnvironment } from './environmentValidator.ts';
import { parseAuthHeader } from './authHeaderParser.ts';
import { validateToken } from './tokenValidator.ts';
import { verifyProfile } from './profileVerifier.ts';
import { SecurityGuard, RATE_LIMIT_CONFIGS } from '../../_shared/securityGuard.ts';
import { SessionSecurityManager } from '../../_shared/sessionSecurity.ts';
import { SecurityAuditLogger } from '../../_shared/securityAudit.ts';

/**
 * Enhanced auth logic for admin functions with comprehensive security:
 * 1. Validate the bearer token (user JWT) with proper error handling
 * 2. Create service role client only after successful authentication
 * 3. Verify admin privileges with strict role checking
 * 4. Implement security logging and monitoring
 * 5. Generate role-based permissions for fine-grained access control
 * 6. Rate limiting and IP whitelisting
 * 7. Session security with timeout controls
 */
export async function verifyAdmin(req: Request): Promise<AuthContext> {
  // Step 1: Validate environment variables
  const envConfig = validateEnvironment();
  if (!envConfig.isValid) {
    throw new Error(envConfig.error);
  }

  const { supabaseUrl, serviceRoleKey, anonKey } = envConfig;

  // Step 2: Extract client information
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                   req.headers.get('x-real-ip') || 
                   req.headers.get('cf-connecting-ip') || 
                   'unknown';
  const userAgent = req.headers.get('user-agent') || '';

  // Step 3: Initialize security components
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const securityGuard = new SecurityGuard(serviceClient);
  const sessionManager = new SessionSecurityManager(serviceClient);
  const auditLogger = new SecurityAuditLogger(serviceClient);

  // Step 4: Security threat assessment
  const threatCheck = await securityGuard.checkSecurityThreats(req);
  if (!threatCheck.allowed) {
    await auditLogger.logSecurityEvent({
      action: 'admin_access_blocked_threat',
      severity: 'high',
      details: {
        reason: threatCheck.reason,
        risk_score: threatCheck.riskScore
      },
      ip_address: ipAddress,
      user_agent: userAgent,
      prevented: true
    });
    
    throw new Error(`Access denied - Security threat detected: ${threatCheck.reason}`);
  }

  // Step 5: Rate limiting check
  const rateLimitResult = await securityGuard.checkRateLimit(
    'admin_access',
    RATE_LIMIT_CONFIGS.ADMIN_MODERATE,
    ipAddress
  );

  if (!rateLimitResult.allowed) {
    await auditLogger.logSecurityEvent({
      action: 'admin_access_rate_limited',
      severity: 'medium',
      details: {
        remaining: rateLimitResult.remaining,
        reset_time: rateLimitResult.resetTime,
        blocked: rateLimitResult.blocked
      },
      ip_address: ipAddress,
      prevented: true
    });
    
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  // Step 6: Extract and validate JWT from header
  const authResult = parseAuthHeader(req);
  if (!authResult.isValid) {
    throw new Error(`Unauthorized - ${authResult.error}`);
  }

  const { token } = authResult;

  try {
    // Step 7: Validate user token
    const tokenResult = await validateToken(token, supabaseUrl, anonKey);
    if (!tokenResult.isValid) {
      throw new Error(`Unauthorized - ${tokenResult.error}`);
    }

    const { user } = tokenResult;

    // Step 8: Verify profile and admin privileges
    const profileResult = await verifyProfile(serviceClient, user);
    if (!profileResult.isValid) {
      throw new Error(`Forbidden - ${profileResult.error}`);
    }

    const { profile, permissions } = profileResult;

    // Step 9: Session security validation
    const sessionValidation = await sessionManager.validateSession(
      token,
      profile.role,
      ipAddress,
      userAgent
    );

    if (!sessionValidation.valid) {
      await auditLogger.logSecurityEvent({
        user_id: user.id,
        action: 'admin_session_invalid',
        severity: 'high',
        details: {
          expired: sessionValidation.expired,
          security_violation: sessionValidation.securityViolation,
          requires_reauth: sessionValidation.requiresReauth
        },
        ip_address: ipAddress
      });
      
      throw new Error(`Session invalid - ${sessionValidation.securityViolation || 'Session expired'}`);
    }

    // Step 10: Log successful authentication with enhanced details
    console.log(`Successfully authenticated admin user ${user.id} with role ${profile.role}`);
    
    await auditLogger.logSecurityEvent({
      user_id: user.id,
      action: 'admin_function_access_granted',
      severity: 'low',
      details: { 
        function: 'get-all-users', 
        success: true,
        role: profile.role,
        permissions: permissions,
        ip_address: ipAddress,
        user_agent: userAgent,
        session_valid: true,
        requires_reauth: sessionValidation.requiresReauth,
        rate_limit_remaining: rateLimitResult.remaining,
        threat_score: threatCheck.riskScore
      },
      ip_address: ipAddress,
      user_agent: userAgent
    });

    return { 
      supabase: serviceClient, 
      userId: user.id,
      userRole: profile.role,
      permissions
    };

  } catch (error: any) {
    // Enhanced error logging with security context
    console.error('Authentication error:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      timestamp: new Date().toISOString(),
      userAgent: userAgent.substring(0, 200),
      ipAddress: ipAddress,
      origin: req.headers.get('origin'),
      referer: req.headers.get('referer')
    });

    // Log failed authentication attempt
    await auditLogger.logSecurityEvent({
      action: 'admin_authentication_failed',
      severity: 'medium',
      details: {
        error: error.message,
        stack: error.stack?.substring(0, 200),
        attempt_source: 'admin_verifier'
      },
      ip_address: ipAddress,
      user_agent: userAgent
    });
    
    // Re-throw with sanitized error message
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden') || error.message.includes('Rate limit') || error.message.includes('Access denied')) {
      throw error; // These are safe to expose
    } else {
      throw new Error('Authentication failed'); // Generic error for security
    }
  }
}
