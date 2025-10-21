// Zero-Trust Access Control Implementation

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/productionLogger';
import { SecurityUtils } from '@/utils/security';

export interface AccessContext {
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, any>;
  location?: Record<string, any>;
  sessionAge?: number;
  riskFactors?: string[];
}

export interface AccessDecision {
  decision: 'allow' | 'deny' | 'conditional';
  riskScore: number;
  factors: Record<string, any>;
  requiredActions?: string[];
  expiresAt?: Date;
}

export class ZeroTrustAccessController {
  private static readonly MAX_RISK_SCORE = 100;
  private static readonly CONDITIONAL_THRESHOLD = 20;
  private static readonly DENY_THRESHOLD = 50;

  /**
   * Evaluate access request using zero-trust principles
   */
  static async evaluateAccess(
    userId: string,
    resourceType: string,
    action: string = 'read',
    context: AccessContext = {}
  ): Promise<AccessDecision> {
    try {
      // Get client IP and user agent from context or browser
      const enrichedContext = await this.enrichContext(context);
      
      // Call database function for evaluation
      const { data, error } = await supabase.rpc('evaluate_access_request', {
        p_user_id: userId,
        p_resource_type: resourceType,
        p_action: action,
        p_context: enrichedContext
      });

      if (error) {
        logger.error('Access evaluation failed', { error, userId, resourceType });
        // Default to deny on error
        return {
          decision: 'deny',
          riskScore: this.MAX_RISK_SCORE,
          factors: { error: 'evaluation_failed' }
        };
      }

      return this.parseDecision(data);
    } catch (error) {
      logger.error('Zero-trust access evaluation error', { error, userId, resourceType });
      return {
        decision: 'deny',
        riskScore: this.MAX_RISK_SCORE,
        factors: { error: 'system_error' }
      };
    }
  }

  /**
   * Check if user has permission for specific resource
   */
  static async hasPermission(
    userId: string,
    resource: string,
    action: string = 'read',
    context: AccessContext = {}
  ): Promise<boolean> {
    const decision = await this.evaluateAccess(userId, resource, action, context);
    return decision.decision === 'allow';
  }

  /**
   * Enforce least privilege principle
   */
  static async enforceLeastPrivilege(
    userId: string,
    requestedPermissions: string[],
    context: AccessContext = {}
  ): Promise<string[]> {
    const grantedPermissions: string[] = [];

    for (const permission of requestedPermissions) {
      const [resource, action] = permission.split(':');
      const hasAccess = await this.hasPermission(userId, resource, action, context);
      
      if (hasAccess) {
        grantedPermissions.push(permission);
      }
    }

    // Log permission enforcement
    await this.logPermissionEnforcement(userId, requestedPermissions, grantedPermissions, context);

    return grantedPermissions;
  }

  /**
   * Dynamic access re-evaluation for sensitive operations
   */
  static async reEvaluateAccess(
    userId: string,
    resourceType: string,
    originalDecision: AccessDecision,
    newContext: AccessContext
  ): Promise<AccessDecision> {
    // Force re-evaluation for high-risk operations
    if (originalDecision.riskScore > this.CONDITIONAL_THRESHOLD) {
      return await this.evaluateAccess(userId, resourceType, 'write', newContext);
    }

    // Check if context has changed significantly
    const contextChanged = await this.hasContextChanged(originalDecision, newContext);
    if (contextChanged) {
      return await this.evaluateAccess(userId, resourceType, 'write', newContext);
    }

    return originalDecision;
  }

  /**
   * Enrich context with additional security data
   */
  private static async enrichContext(context: AccessContext): Promise<Record<string, any>> {
    const enriched: Record<string, any> = { ...context };

    // Add browser fingerprint data
    if (typeof window !== 'undefined') {
      enriched.userAgent = navigator.userAgent;
      enriched.language = navigator.language;
      enriched.platform = navigator.platform;
      enriched.cookieEnabled = navigator.cookieEnabled;
      enriched.screenResolution = `${screen.width}x${screen.height}`;
      enriched.timezoneOffset = new Date().getTimezoneOffset();
    }

      // Add session age if available
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          enriched.sessionAge = Date.now() - new Date().getTime();
        }
      } catch (error) {
        logger.warn('Failed to get session age', { error });
      }

    return enriched;
  }

  /**
   * Parse decision from database response
   */
  private static parseDecision(data: any): AccessDecision {
    const decision: AccessDecision = {
      decision: data.decision || 'deny',
      riskScore: data.risk_score || this.MAX_RISK_SCORE,
      factors: data.factors || {}
    };

    // Add required actions based on decision
    if (decision.decision === 'conditional') {
      decision.requiredActions = this.determineRequiredActions(decision.factors);
    }

    // Set expiration for allow decisions
    if (decision.decision === 'allow') {
      decision.expiresAt = new Date(Date.now() + (15 * 60 * 1000)); // 15 minutes
    }

    return decision;
  }

  /**
   * Determine required actions for conditional access
   */
  private static determineRequiredActions(factors: Record<string, any>): string[] {
    const actions: string[] = [];

    if (factors.invalid_session) {
      actions.push('reauthenticate');
    }

    if (factors.fingerprint_mismatch) {
      actions.push('verify_device');
    }

    if (factors.ip_change) {
      actions.push('verify_location');
    }

    if (factors.recent_incidents) {
      actions.push('security_verification');
    }

    return actions;
  }

  /**
   * Check if context has changed significantly
   */
  private static async hasContextChanged(
    originalDecision: AccessDecision,
    newContext: AccessContext
  ): Promise<boolean> {
    // Check for significant IP change
    if (newContext.ipAddress && originalDecision.factors.ip_address) {
      if (newContext.ipAddress !== originalDecision.factors.ip_address) {
        return true;
      }
    }

    // Check for user agent change
    if (newContext.userAgent && originalDecision.factors.user_agent) {
      if (newContext.userAgent !== originalDecision.factors.user_agent) {
        return true;
      }
    }

    // Check decision age
    if (originalDecision.expiresAt && new Date() > originalDecision.expiresAt) {
      return true;
    }

    return false;
  }

  /**
   * Log permission enforcement for audit
   */
  private static async logPermissionEnforcement(
    userId: string,
    requested: string[],
    granted: string[],
    context: AccessContext
  ): Promise<void> {
    try {
      await supabase.from('security_logs').insert({
        user_id: userId,
        action: 'permission_enforcement',
        details: {
          requested_permissions: requested,
          granted_permissions: granted,
          denied_count: requested.length - granted.length
        },
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
        severity: 'info',
        event_category: 'access_control'
      });
    } catch (error) {
      logger.error('Failed to log permission enforcement', { error });
    }
  }

  /**
   * Get current access status for user
   */
  static async getAccessStatus(userId: string): Promise<{
    activeSession: boolean;
    riskScore: number;
    lastEvaluation: Date;
    restrictions: string[];
  }> {
    try {
      // Get recent access evaluations
      const { data: evaluations } = await supabase
        .from('access_evaluations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      const latestEval = evaluations?.[0];

      // Check active sessions
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      return {
        activeSession: (sessions?.length || 0) > 0,
        riskScore: latestEval?.risk_score || 0,
        lastEvaluation: latestEval ? new Date(latestEval.created_at) : new Date(),
        restrictions: this.extractRestrictions(
          typeof latestEval?.evaluation_factors === 'object' ? 
            latestEval.evaluation_factors as Record<string, any> : {}
        )
      };
    } catch (error) {
      logger.error('Failed to get access status', { error, userId });
      return {
        activeSession: false,
        riskScore: this.MAX_RISK_SCORE,
        lastEvaluation: new Date(),
        restrictions: ['system_error']
      };
    }
  }

  /**
   * Extract active restrictions from evaluation factors
   */
  private static extractRestrictions(factors: Record<string, any>): string[] {
    const restrictions: string[] = [];

    if (factors.invalid_session) restrictions.push('authentication_required');
    if (factors.recent_incidents) restrictions.push('security_hold');
    if (factors.ip_change) restrictions.push('location_verification');
    if (factors.fingerprint_mismatch) restrictions.push('device_verification');

    return restrictions;
  }
}