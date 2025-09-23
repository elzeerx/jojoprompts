// API Security Middleware with Request Signing and Advanced Rate Limiting

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/productionLogger';
import CryptoJS from 'crypto-js';

export interface APISecurityConfig {
  enableRequestSigning: boolean;
  rateLimitEnabled: boolean;
  abuseDetectionEnabled: boolean;
  signatureSecret?: string;
  customRateLimits?: Record<string, number>;
}

export interface RequestMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  userAgent?: string;
  ipAddress?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number;
}

export class APISecurityMiddleware {
  private static config: APISecurityConfig = {
    enableRequestSigning: true,
    rateLimitEnabled: true,
    abuseDetectionEnabled: true
  };

  private static readonly DEFAULT_RATE_LIMITS = {
    '/api/auth': 10, // 10 per minute
    '/api/prompts': 100, // 100 per hour
    '/api/admin': 20, // 20 per hour
    '/api/payment': 5, // 5 per minute
    'default': 60 // 60 per hour
  };

  /**
   * Configure API security settings
   */
  static configure(config: Partial<APISecurityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Validate API request with comprehensive security checks
   */
  static async validateRequest(
    endpoint: string,
    method: string,
    headers: Record<string, string> = {},
    body?: any,
    userId?: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    rateLimit?: RateLimitResult;
    signature?: string;
  }> {
    try {
      const startTime = Date.now();
      
      // 1. Rate limiting check
      if (this.config.rateLimitEnabled) {
        const rateLimitResult = await this.checkRateLimit(endpoint, method, userId);
        if (!rateLimitResult.allowed) {
          return {
            allowed: false,
            reason: 'rate_limit_exceeded',
            rateLimit: rateLimitResult
          };
        }
      }

      // 2. Request signature validation
      if (this.config.enableRequestSigning && headers['x-request-signature']) {
        const signatureValid = await this.validateRequestSignature(
          endpoint, method, body, headers['x-request-signature']
        );
        if (!signatureValid) {
          return {
            allowed: false,
            reason: 'invalid_signature'
          };
        }
      }

      // 3. Abuse detection
      if (this.config.abuseDetectionEnabled) {
        const isAbusive = await this.detectAbuse(endpoint, method, headers, userId);
        if (isAbusive) {
          return {
            allowed: false,
            reason: 'abuse_detected'
          };
        }
      }

      // 4. Log the request
      await this.logAPIRequest({
        endpoint,
        method,
        responseTime: Date.now() - startTime,
        statusCode: 200, // Will be updated later
        userAgent: headers['user-agent'],
        ipAddress: await this.getClientIP()
      }, userId);

      return { allowed: true };
    } catch (error) {
      logger.error('API request validation failed', { error, endpoint, method });
      return {
        allowed: false,
        reason: 'validation_error'
      };
    }
  }

  /**
   * Generate request signature for API calls
   */
  static generateRequestSignature(
    endpoint: string,
    method: string,
    body?: any,
    timestamp?: number
  ): string {
    const ts = timestamp || Date.now();
    const payload = `${method}:${endpoint}:${JSON.stringify(body || {})}:${ts}`;
    const secret = this.config.signatureSecret || 'default-secret';
    
    return CryptoJS.HmacSHA256(payload, secret).toString();
  }

  /**
   * Validate request signature
   */
  static async validateRequestSignature(
    endpoint: string,
    method: string,
    body: any,
    providedSignature: string,
    timestamp?: number
  ): Promise<boolean> {
    try {
      const expectedSignature = this.generateRequestSignature(endpoint, method, body, timestamp);
      return expectedSignature === providedSignature;
    } catch (error) {
      logger.error('Signature validation failed', { error });
      return false;
    }
  }

  /**
   * Advanced rate limiting with behavioral analysis
   */
  static async checkRateLimit(
    endpoint: string,
    method: string,
    userId?: string,
    ipAddress?: string
  ): Promise<RateLimitResult> {
    try {
      const clientIP = ipAddress || await this.getClientIP();
      
      // Call database function for validation
      const { data, error } = await supabase.rpc('validate_api_request', {
        p_endpoint: endpoint,
        p_method: method,
        p_user_id: userId,
        p_ip_address: clientIP,
        p_user_agent: navigator.userAgent
      });

      if (error) {
        logger.error('Rate limit check failed', { error });
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime: new Date(Date.now() + 3600000), // 1 hour
          retryAfter: 3600
        };
      }

      const response = data as any;
      return {
        allowed: response.allowed || false,
        remainingRequests: Math.max(0, this.getRateLimit(endpoint) - (response.request_count || 0)),
        resetTime: new Date(Date.now() + ((response.window_remaining_seconds || 3600) * 1000)),
        retryAfter: response.rate_limit_exceeded ? response.window_remaining_seconds : undefined
      };
    } catch (error) {
      logger.error('Rate limit check error', { error });
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 3600000)
      };
    }
  }

  /**
   * Detect API abuse patterns
   */
  static async detectAbuse(
    endpoint: string,
    method: string,
    headers: Record<string, string>,
    userId?: string
  ): Promise<boolean> {
    try {
      const userAgent = headers['user-agent'] || '';
      const clientIP = await this.getClientIP();

      // Check for bot patterns
      const botPatterns = [
        /bot/i, /crawler/i, /spider/i, /scraper/i,
        /automated/i, /python/i, /curl/i, /wget/i
      ];

      if (botPatterns.some(pattern => pattern.test(userAgent))) {
        await this.logSuspiciousActivity('bot_user_agent', { userAgent, endpoint, userId });
        return true;
      }

      // Check for rapid sequential requests
      const recentRequests = await this.getRecentRequests(clientIP, userId, 60); // Last 60 seconds
      if (recentRequests.length > 30) { // More than 30 requests in 1 minute
        await this.logSuspiciousActivity('rapid_requests', { 
          requestCount: recentRequests.length, 
          endpoint, 
          userId 
        });
        return true;
      }

      // Check for unusual request patterns
      const endpoints = new Set(recentRequests.map(r => r.endpoint));
      if (endpoints.size > 10 && recentRequests.length > 20) { // Accessing many different endpoints rapidly
        await this.logSuspiciousActivity('endpoint_scanning', { 
          endpointCount: endpoints.size, 
          requestCount: recentRequests.length, 
          userId 
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Abuse detection failed', { error });
      return false;
    }
  }

  /**
   * Log API request for monitoring
   */
  static async logAPIRequest(metrics: RequestMetrics, userId?: string): Promise<void> {
    try {
      await supabase.from('api_request_logs').insert({
        user_id: userId,
        endpoint: metrics.endpoint,
        method: metrics.method,
        ip_address: metrics.ipAddress,
        user_agent: metrics.userAgent,
        response_status: metrics.statusCode,
        response_time_ms: metrics.responseTime,
        risk_score: this.calculateRequestRisk(metrics),
        is_suspicious: this.isRequestSuspicious(metrics)
      });
    } catch (error) {
      logger.error('Failed to log API request', { error });
    }
  }

  /**
   * Get rate limit for specific endpoint
   */
  private static getRateLimit(endpoint: string): number {
    // Check custom rate limits first
    if (this.config.customRateLimits) {
      for (const [pattern, limit] of Object.entries(this.config.customRateLimits)) {
        if (endpoint.includes(pattern)) {
          return limit;
        }
      }
    }

    // Check default rate limits
    for (const [pattern, limit] of Object.entries(this.DEFAULT_RATE_LIMITS)) {
      if (pattern === 'default') continue;
      if (endpoint.includes(pattern)) {
        return limit;
      }
    }

    return this.DEFAULT_RATE_LIMITS.default;
  }

  /**
   * Get recent requests for IP/user
   */
  private static async getRecentRequests(
    ipAddress: string, 
    userId?: string, 
    seconds: number = 300
  ): Promise<any[]> {
    try {
      const since = new Date(Date.now() - (seconds * 1000)).toISOString();
      
      let query = supabase
        .from('api_request_logs')
        .select('endpoint, created_at')
        .gte('created_at', since);

      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.eq('ip_address', ipAddress);
      }

      const { data } = await query.order('created_at', { ascending: false });
      return data || [];
    } catch (error) {
      logger.error('Failed to get recent requests', { error });
      return [];
    }
  }

  /**
   * Log suspicious activity
   */
  private static async logSuspiciousActivity(
    type: string, 
    details: Record<string, any>
  ): Promise<void> {
    try {
      await supabase.from('security_logs').insert({
        user_id: details.userId,
        action: 'api_abuse_detected',
        details: { type, ...details },
        severity: 'medium',
        event_category: 'api_security'
      });
    } catch (error) {
      logger.error('Failed to log suspicious activity', { error });
    }
  }

  /**
   * Calculate request risk score
   */
  private static calculateRequestRisk(metrics: RequestMetrics): number {
    let risk = 0;

    // High response time might indicate complex queries or attacks
    if (metrics.responseTime > 5000) risk += 10;
    else if (metrics.responseTime > 2000) risk += 5;

    // Error responses might indicate probing
    if (metrics.statusCode >= 400) risk += 15;

    // Admin endpoints are higher risk
    if (metrics.endpoint.includes('/admin')) risk += 20;

    // Authentication endpoints are higher risk
    if (metrics.endpoint.includes('/auth')) risk += 10;

    return Math.min(risk, 100);
  }

  /**
   * Check if request is suspicious
   */
  private static isRequestSuspicious(metrics: RequestMetrics): boolean {
    return this.calculateRequestRisk(metrics) > 30;
  }

  /**
   * Get client IP address
   */
  private static async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Create signed API request
   */
  static createSignedRequest(
    endpoint: string,
    method: string,
    body?: any,
    additionalHeaders: Record<string, string> = {}
  ): {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  } {
    const timestamp = Date.now();
    const signature = this.generateRequestSignature(endpoint, method, body, timestamp);

    return {
      url: endpoint,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Signature': signature,
        'X-Request-Timestamp': timestamp.toString(),
        ...additionalHeaders
      },
      body: body ? JSON.stringify(body) : undefined
    };
  }
}