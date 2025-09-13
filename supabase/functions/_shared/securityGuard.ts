// Rate limiting and IP whitelisting security layer
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipWhitelisted: boolean;
  blockDuration?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  blocked?: boolean;
}

export interface IPWhitelistEntry {
  ip_address: string;
  description: string;
  created_by: string;
  expires_at?: string;
  is_active: boolean;
}

// Default rate limit configurations
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  ADMIN_STRICT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    skipWhitelisted: true,
    blockDuration: 5 * 60 * 1000 // 5 minutes
  },
  ADMIN_MODERATE: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    skipWhitelisted: true,
    blockDuration: 2 * 60 * 1000 // 2 minutes
  },
  PASSWORD_CHANGE: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3,
    skipWhitelisted: false,
    blockDuration: 15 * 60 * 1000 // 15 minutes
  },
  USER_CREATION: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    skipWhitelisted: true,
    blockDuration: 10 * 60 * 1000 // 10 minutes
  },
  BULK_OPERATIONS: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3,
    skipWhitelisted: false,
    blockDuration: 30 * 60 * 1000 // 30 minutes
  }
};

export class SecurityGuard {
  private supabase: ReturnType<typeof createClient>;
  private rateLimitStore: Map<string, { count: number; windowStart: number; blocked?: number }>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
    this.rateLimitStore = new Map();
  }

  async checkRateLimit(
    identifier: string,
    config: RateLimitConfig,
    ipAddress?: string
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const key = `${identifier}:${ipAddress || 'unknown'}`;

    // Check if IP is whitelisted and should skip rate limiting
    if (config.skipWhitelisted && ipAddress) {
      const isWhitelisted = await this.isIPWhitelisted(ipAddress);
      if (isWhitelisted) {
        return {
          allowed: true,
          remaining: config.maxRequests,
          resetTime: now + config.windowMs
        };
      }
    }

    // Get current rate limit data
    let limitData = this.rateLimitStore.get(key);

    // Check if currently blocked
    if (limitData?.blocked && now < limitData.blocked) {
      await this.logRateLimitViolation(identifier, 'blocked_request', ipAddress);
      return {
        allowed: false,
        remaining: 0,
        resetTime: limitData.blocked,
        blocked: true
      };
    }

    // Initialize or reset window if expired
    if (!limitData || (now - limitData.windowStart) >= config.windowMs) {
      limitData = {
        count: 0,
        windowStart: now
      };
    }

    // Increment request count
    limitData.count++;

    // Check if limit exceeded
    if (limitData.count > config.maxRequests) {
      // Block for specified duration
      if (config.blockDuration) {
        limitData.blocked = now + config.blockDuration;
      }

      this.rateLimitStore.set(key, limitData);
      
      await this.logRateLimitViolation(identifier, 'rate_limit_exceeded', ipAddress, {
        requests: limitData.count,
        limit: config.maxRequests,
        window_ms: config.windowMs
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: limitData.windowStart + config.windowMs,
        blocked: !!config.blockDuration
      };
    }

    // Update store
    this.rateLimitStore.set(key, limitData);

    return {
      allowed: true,
      remaining: config.maxRequests - limitData.count,
      resetTime: limitData.windowStart + config.windowMs
    };
  }

  async isIPWhitelisted(ipAddress: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('ip_whitelist')
        .select('id')
        .eq('ip_address', ipAddress)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
        .maybeSingle();

      return !error && !!data;
    } catch (error) {
      console.error('Failed to check IP whitelist:', error);
      return false;
    }
  }

  async addIPToWhitelist(
    ipAddress: string,
    description: string,
    createdBy: string,
    expiresAt?: Date
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('ip_whitelist')
        .insert({
          ip_address: ipAddress,
          description,
          created_by: createdBy,
          expires_at: expiresAt?.toISOString(),
          is_active: true,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to add IP to whitelist:', error);
        return false;
      }

      await this.logSecurityAction('ip_whitelisted', {
        ip_address: ipAddress,
        description,
        created_by: createdBy,
        expires_at: expiresAt?.toISOString()
      });

      return true;
    } catch (error) {
      console.error('Failed to add IP to whitelist:', error);
      return false;
    }
  }

  async removeIPFromWhitelist(ipAddress: string, removedBy: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('ip_whitelist')
        .update({ is_active: false })
        .eq('ip_address', ipAddress);

      if (error) {
        console.error('Failed to remove IP from whitelist:', error);
        return false;
      }

      await this.logSecurityAction('ip_removed_from_whitelist', {
        ip_address: ipAddress,
        removed_by: removedBy
      });

      return true;
    } catch (error) {
      console.error('Failed to remove IP from whitelist:', error);
      return false;
    }
  }

  async checkSecurityThreats(req: Request, userId?: string): Promise<{
    allowed: boolean;
    reason?: string;
    riskScore: number;
  }> {
    const ipAddress = this.getClientIP(req);
    const userAgent = req.headers.get('user-agent') || '';
    let riskScore = 0;

    // Check for suspicious patterns
    const threats: string[] = [];

    // Check user agent
    if (!userAgent || userAgent.length < 10) {
      riskScore += 3;
      threats.push('suspicious_user_agent');
    }

    // Check for common attack patterns in user agent
    const suspiciousPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /sqlmap/i, /nmap/i, /curl/i, /wget/i
    ];

    if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      riskScore += 5;
      threats.push('automated_tool_detected');
    }

    // Check for recent suspicious activity from this IP
    if (ipAddress) {
      const recentViolations = await this.getRecentViolations(ipAddress);
      if (recentViolations > 3) {
        riskScore += 7;
        threats.push('multiple_violations');
      }
    }

    // Check if IP is known threat
    const isKnownThreat = await this.isKnownThreat(ipAddress);
    if (isKnownThreat) {
      riskScore += 10;
      threats.push('known_threat_ip');
    }

    const allowed = riskScore < 8; // Threshold for blocking

    if (!allowed) {
      await this.logSecurityAction('security_threat_blocked', {
        ip_address: ipAddress,
        user_agent: userAgent,
        user_id: userId,
        threats,
        risk_score: riskScore
      });
    }

    return {
      allowed,
      reason: threats.join(', '),
      riskScore
    };
  }

  private getClientIP(req: Request): string {
    return (
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      'unknown'
    );
  }

  private async getRecentViolations(ipAddress: string): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { count } = await this.supabase
        .from('security_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', ipAddress)
        .in('action', ['rate_limit_exceeded', 'authentication_failed', 'permission_denied'])
        .gte('created_at', oneHourAgo);

      return count || 0;
    } catch (error) {
      console.error('Failed to get recent violations:', error);
      return 0;
    }
  }

  private async isKnownThreat(ipAddress?: string): Promise<boolean> {
    if (!ipAddress) return false;
    
    try {
      const { data } = await this.supabase
        .from('threat_ips')
        .select('id')
        .eq('ip_address', ipAddress)
        .eq('is_active', true)
        .maybeSingle();

      return !!data;
    } catch (error) {
      console.error('Failed to check threat IP:', error);
      return false;
    }
  }

  private async logRateLimitViolation(
    identifier: string,
    action: string,
    ipAddress?: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase
        .from('security_logs')
        .insert({
          action,
          details: {
            identifier,
            ...details,
            timestamp: new Date().toISOString()
          },
          ip_address: ipAddress,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log rate limit violation:', error);
    }
  }

  private async logSecurityAction(action: string, details: Record<string, any>): Promise<void> {
    try {
      await this.supabase
        .from('security_logs')
        .insert({
          action,
          details: {
            ...details,
            timestamp: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log security action:', error);
    }
  }
}