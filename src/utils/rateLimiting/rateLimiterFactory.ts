
// Rate limiter factory
export class RateLimiterFactory {
  // Create rate limiter function
  static createRateLimiter(maxRequests: number, windowMs: number) {
    const attempts = new Map<string, { count: number; resetTime: number }>();

    return (identifier: string): boolean => {
      const now = Date.now();
      const record = attempts.get(identifier);

      if (!record || now > record.resetTime) {
        attempts.set(identifier, { count: 1, resetTime: now + windowMs });
        return true;
      }

      if (record.count >= maxRequests) {
        return false;
      }

      record.count++;
      return true;
    };
  }
}
