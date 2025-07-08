
import { supabase } from '@/integrations/supabase/client';

interface RateLimitRecord {
  attempts: number;
  windowStart: number;
  blockedUntil?: number;
  lastAttempt: number;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
  progressiveDelay?: boolean;
}

class EnhancedRateLimiter {
  private storage = new Map<string, RateLimitRecord>();

  // Enhanced rate limiting with progressive delays
  isAllowed(key: string, config: RateLimitConfig): { 
    allowed: boolean; 
    retryAfter?: number;
    attemptsLeft?: number;
  } {
    const now = Date.now();
    const record = this.storage.get(key);

    // Check if currently blocked
    if (record?.blockedUntil && now < record.blockedUntil) {
      return {
        allowed: false,
        retryAfter: Math.ceil((record.blockedUntil - now) / 1000)
      };
    }

    // Initialize or reset window if needed
    if (!record || now - record.windowStart > config.windowMs) {
      this.storage.set(key, {
        attempts: 1,
        windowStart: now,
        lastAttempt: now
      });
      return { 
        allowed: true, 
        attemptsLeft: config.maxAttempts - 1 
      };
    }

    // Progressive delay for rapid attempts (but more lenient)
    if (config.progressiveDelay && record.lastAttempt) {
      const timeSinceLastAttempt = now - record.lastAttempt;
      const minimumDelay = Math.min(500 * Math.pow(1.5, record.attempts - 1), 5000); // Max 5s delay
      
      if (timeSinceLastAttempt < minimumDelay && record.attempts > 2) {
        return {
          allowed: false,
          retryAfter: Math.ceil((minimumDelay - timeSinceLastAttempt) / 1000)
        };
      }
    }

    // Check if within rate limit
    if (record.attempts < config.maxAttempts) {
      record.attempts++;
      record.lastAttempt = now;
      return { 
        allowed: true, 
        attemptsLeft: config.maxAttempts - record.attempts 
      };
    }

    // Rate limit exceeded - apply blocking
    if (config.blockDurationMs) {
      record.blockedUntil = now + config.blockDurationMs;
      return {
        allowed: false,
        retryAfter: Math.ceil(config.blockDurationMs / 1000)
      };
    }

    return {
      allowed: false,
      retryAfter: Math.ceil((config.windowMs - (now - record.windowStart)) / 1000)
    };
  }

  recordFailedAttempt(key: string, metadata?: Record<string, any>): void {
    const now = Date.now();
    const record = this.storage.get(key);

    if (record) {
      record.attempts++;
      record.lastAttempt = now;
    } else {
      this.storage.set(key, {
        attempts: 1,
        windowStart: now,
        lastAttempt: now
      });
    }

    // Log to server for persistent tracking
    this.logAttemptToServer(key, metadata).catch(console.error);
  }

  private async logAttemptToServer(key: string, metadata?: Record<string, any>) {
    try {
      await supabase.functions.invoke('log-rate-limit-attempt', {
        body: { key, metadata, timestamp: new Date().toISOString() }
      });
    } catch (error) {
      console.warn('Failed to log rate limit attempt:', error);
    }
  }

  reset(key: string): void {
    this.storage.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.storage.entries()) {
      if (record.blockedUntil && now > record.blockedUntil && 
          now - record.windowStart > 3600000) {
        this.storage.delete(key);
      }
    }
  }
}

// Enhanced configurations with more lenient payment limits
export const EnhancedRateLimitConfigs = {
  AUTH_LOGIN: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
    progressiveDelay: true
  },
  AUTH_SIGNUP: {
    maxAttempts: 3,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDurationMs: 60 * 60 * 1000, // 1 hour
    progressiveDelay: true
  },
  PASSWORD_RESET: {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 60 * 60 * 1000, // 1 hour
    progressiveDelay: true
  },
  PAYMENT_ATTEMPT: {
    maxAttempts: 5, // Increased from 3 to 5
    windowMs: 10 * 60 * 1000, // Increased from 5 to 10 minutes
    blockDurationMs: 10 * 60 * 1000, // Reduced from 15 to 10 minutes
    progressiveDelay: true
  },
  API_CALL: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
    progressiveDelay: false
  }
};

export const enhancedRateLimiter = new EnhancedRateLimiter();

// Cleanup every hour
setInterval(() => {
  enhancedRateLimiter.cleanup();
}, 3600000);
