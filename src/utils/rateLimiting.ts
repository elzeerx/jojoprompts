
// Client-side rate limiting utility

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

interface AttemptRecord {
  attempts: number;
  windowStart: number;
  blockedUntil?: number;
}

export class RateLimiter {
  private static storage = new Map<string, AttemptRecord>();

  static isAllowed(key: string, config: RateLimitConfig): { allowed: boolean; retryAfter?: number } {
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
        windowStart: now
      });
      return { allowed: true };
    }

    // Check if within rate limit
    if (record.attempts < config.maxAttempts) {
      record.attempts++;
      return { allowed: true };
    }

    // Rate limit exceeded - block if configured
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

  static recordAttempt(key: string): void {
    const now = Date.now();
    const record = this.storage.get(key);

    if (record) {
      record.attempts++;
    } else {
      this.storage.set(key, {
        attempts: 1,
        windowStart: now
      });
    }
  }

  static reset(key: string): void {
    this.storage.delete(key);
  }

  static cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.storage.entries()) {
      // Remove expired records
      if (record.blockedUntil && now > record.blockedUntil && 
          now - record.windowStart > 3600000) { // 1 hour
        this.storage.delete(key);
      }
    }
  }
}

// Predefined rate limit configurations
export const RateLimitConfigs = {
  LOGIN: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 30 * 60 * 1000 // 30 minutes
  },
  SIGNUP: {
    maxAttempts: 3,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDurationMs: 60 * 60 * 1000 // 1 hour
  },
  PASSWORD_RESET: {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDurationMs: 60 * 60 * 1000 // 1 hour
  },
  API_CALL: {
    maxAttempts: 100,
    windowMs: 60 * 1000 // 1 minute
  }
};

// Cleanup expired records every hour
setInterval(() => {
  RateLimiter.cleanup();
}, 3600000);
