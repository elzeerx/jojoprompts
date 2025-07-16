// Advanced cache management for user data
export interface CacheEntry {
  data: any;
  timestamp: number;
  search?: string;
  totalUsers: number;
  filteredUsers: number;
  etag: string;
}

class UserCacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL = 30000; // 30 seconds
  private readonly MAX_ENTRIES = 10;

  generateCacheKey(search: string = '', page: number = 1, limit: number = 10): string {
    return `users_${search}_${page}_${limit}`;
  }

  generateETag(data: any): string {
    return btoa(JSON.stringify({ timestamp: Date.now(), length: data.length }));
  }

  set(key: string, data: any, search?: string, totalUsers?: number, filteredUsers?: number): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      search,
      totalUsers: totalUsers || 0,
      filteredUsers: filteredUsers || 0,
      etag: this.generateETag(data)
    });
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      console.log('[Cache] Full cache invalidation');
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
    console.log(`[Cache] Pattern invalidation: ${pattern}`);
  }

  getStats(): { size: number; entries: string[]; hitRate?: number } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }
}

export const userCacheManager = new UserCacheManager();

// Periodic cleanup
setInterval(() => {
  userCacheManager.cleanup();
}, 60000); // Run every minute