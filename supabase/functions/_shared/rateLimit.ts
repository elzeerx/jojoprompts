import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { createEdgeLogger } from './logger.ts';

const logger = createEdgeLogger('RATE_LIMIT');

export interface RateLimitConfig {
  endpoint: string;
  maxRequests: number;
  windowMinutes: number;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  windowMinutes: number;
  windowResetsAt: string;
}

/**
 * Check if a user has exceeded the rate limit for a specific endpoint
 * @param supabase Supabase client instance
 * @param userId User ID to check rate limit for
 * @param config Rate limit configuration
 * @returns Rate limit result with allowed status and details
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_endpoint: config.endpoint,
      p_max_requests: config.maxRequests,
      p_window_minutes: config.windowMinutes
    });

    if (error) {
      logger.error('Rate limit check failed', { error: error.message, userId, endpoint: config.endpoint });
      // On error, allow the request but log the failure
      return {
        allowed: true,
        currentCount: 0,
        limit: config.maxRequests,
        windowMinutes: config.windowMinutes,
        windowResetsAt: new Date().toISOString()
      };
    }

    logger.debug('Rate limit check', {
      userId,
      endpoint: config.endpoint,
      allowed: data.allowed,
      currentCount: data.current_count,
      limit: data.limit
    });

    return data;
  } catch (error: any) {
    logger.error('Rate limit check exception', { error: error.message, userId, endpoint: config.endpoint });
    // On exception, allow the request but log the failure
    return {
      allowed: true,
      currentCount: 0,
      limit: config.maxRequests,
      windowMinutes: config.windowMinutes,
      windowResetsAt: new Date().toISOString()
    };
  }
}

/**
 * Standard rate limit configurations for common endpoints
 */
export const RATE_LIMITS = {
  // Admin user listing - strict limit to prevent enumeration
  GET_ALL_USERS: {
    endpoint: 'get-all-users',
    maxRequests: 20, // 20 requests per 5 minutes = ~500 users max
    windowMinutes: 5
  },
  
  // Payment processing - moderate limit
  PROCESS_PAYMENT: {
    endpoint: 'process-paypal-payment',
    maxRequests: 10,
    windowMinutes: 5
  },
  
  // Email sending - prevent spam
  RESEND_EMAIL: {
    endpoint: 'resend-payment-email',
    maxRequests: 10,
    windowMinutes: 5
  },
  
  // Payment verification - lenient for legitimate retries
  VERIFY_PAYMENT: {
    endpoint: 'verify-paypal-payment',
    maxRequests: 30,
    windowMinutes: 5
  }
} as const;

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(rateLimitResult: RateLimitResult, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `You have exceeded the rate limit. Please try again after ${rateLimitResult.windowResetsAt}`,
      rateLimitDetails: {
        limit: rateLimitResult.limit,
        currentCount: rateLimitResult.currentCount,
        windowMinutes: rateLimitResult.windowMinutes,
        resetsAt: rateLimitResult.windowResetsAt
      }
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil(rateLimitResult.windowMinutes * 60).toString(),
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': Math.max(0, rateLimitResult.limit - rateLimitResult.currentCount).toString(),
        'X-RateLimit-Reset': rateLimitResult.windowResetsAt
      }
    }
  );
}
