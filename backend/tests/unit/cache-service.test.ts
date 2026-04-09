import { describe, it, expect, beforeEach } from 'vitest';
import { CacheService, CacheResult, CacheTier } from '../../src/services/cache-service';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = CacheService.getInstance();
    cacheService.clearAll();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(CacheService);
    });
  });

  describe('get and set', () => {
    it('should set and get cache entry', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const chainId = 1;
      const result = {
        riskScore: 75,
        riskLevel: 'HIGH' as const,
        decision: 'BLOCK' as const,
        riskType: 'HACKER'
      };

      cacheService.set(address, chainId, result, CacheTier.MEDIUM);
      
      const cached = cacheService.get(address, chainId);
      
      expect(cached).not.toBeNull();
      expect(cached!.riskScore).toBe(75);
      expect(cached!.riskLevel).toBe('HIGH');
      expect(cached!.decision).toBe('BLOCK');
      expect(cached!.riskType).toBe('HACKER');
      expect(cached!.cacheTier).toBe(CacheTier.MEDIUM);
      expect(cached!.cachedAt).toBeInstanceOf(Date);
      expect(cached!.expiresAt).toBeInstanceOf(Date);
    });

    it('should return null for missing cache entry', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const chainId = 1;
      
      const cached = cacheService.get(address, chainId);
      
      expect(cached).toBeNull();
    });

    it('should handle different chain IDs as separate keys', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const result = {
        riskScore: 75,
        riskLevel: 'HIGH' as const,
        decision: 'BLOCK' as const
      };

      cacheService.set(address, 1, result, CacheTier.MEDIUM);
      cacheService.set(address, 56, { ...result, riskScore: 50 }, CacheTier.MEDIUM);
      
      const cached1 = cacheService.get(address, 1);
      const cached56 = cacheService.get(address, 56);
      
      expect(cached1).not.toBeNull();
      expect(cached56).not.toBeNull();
      expect(cached1!.riskScore).toBe(75);
      expect(cached56!.riskScore).toBe(50);
    });

    it('should handle addresses case-insensitively', () => {
      const addressLower = '0x1234567890abcdef1234567890abcdef12345678';
      const addressUpper = '0x1234567890ABCDEF1234567890ABCDEF12345678';
      const result = {
        riskScore: 75,
        riskLevel: 'HIGH' as const,
        decision: 'BLOCK' as const
      };

      cacheService.set(addressLower, 1, result, CacheTier.MEDIUM);
      
      const cachedLower = cacheService.get(addressLower, 1);
      const cachedUpper = cacheService.get(addressUpper, 1);
      
      expect(cachedLower).not.toBeNull();
      expect(cachedUpper).not.toBeNull();
      expect(cachedLower!.riskScore).toBe(75);
      expect(cachedUpper!.riskScore).toBe(75);
    });

    it('should support different cache tiers with different TTLs', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const result = {
        riskScore: 75,
        riskLevel: 'HIGH' as const,
        decision: 'BLOCK' as const
      };

      cacheService.set(address, 1, result, CacheTier.HIGH);
      cacheService.set(address, 56, result, CacheTier.WHITELIST);
      
      const cached1 = cacheService.get(address, 1);
      const cached56 = cacheService.get(address, 56);
      
      expect(cached1).not.toBeNull();
      expect(cached56).not.toBeNull();
      expect(cached1!.cacheTier).toBe(CacheTier.HIGH);
      expect(cached56!.cacheTier).toBe(CacheTier.WHITELIST);
    });

    it('should handle HIGH tier with zero TTL (permanent)', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const result = {
        riskScore: 85,
        riskLevel: 'HIGH' as const,
        decision: 'BLOCK' as const,
        riskType: 'SANCTION'
      };

      cacheService.set(address, 1, result, CacheTier.HIGH);
      
      const cached = cacheService.get(address, 1);
      
      expect(cached).not.toBeNull();
      expect(cached!.cacheTier).toBe(CacheTier.HIGH);
      expect(cached!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 1000 * 60 * 60 * 24 * 365 * 9); // ~10 years
    });
  });

  describe('clear', () => {
    it('should clear specific cache entry', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const chainId = 1;
      const result = {
        riskScore: 75,
        riskLevel: 'HIGH' as const,
        decision: 'BLOCK' as const
      };

      cacheService.set(address, chainId, result, CacheTier.MEDIUM);
      
      const cachedBefore = cacheService.get(address, chainId);
      expect(cachedBefore).not.toBeNull();
      
      const deleted = cacheService.clear(address, chainId);
      expect(deleted).toBe(true);
      
      const cachedAfter = cacheService.get(address, chainId);
      expect(cachedAfter).toBeNull();
    });

    it('should return false when clearing non-existent entry', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const chainId = 1;
      
      const deleted = cacheService.clear(address, chainId);
      expect(deleted).toBe(false);
    });

    it('should clear only specific chainId entry', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const result = {
        riskScore: 75,
        riskLevel: 'HIGH' as const,
        decision: 'BLOCK' as const
      };

      cacheService.set(address, 1, result, CacheTier.MEDIUM);
      cacheService.set(address, 56, result, CacheTier.MEDIUM);
      
      const deleted = cacheService.clear(address, 1);
      expect(deleted).toBe(true);
      
      const cached1 = cacheService.get(address, 1);
      const cached56 = cacheService.get(address, 56);
      
      expect(cached1).toBeNull();
      expect(cached56).not.toBeNull();
    });
  });

  describe('clearAll', () => {
    it('should clear all cache entries', () => {
      const address1 = '0x1234567890abcdef1234567890abcdef12345678';
      const address2 = '0x098B716B8Aaf21512996dC57EB0615e2383E2f96';
      const result = {
        riskScore: 75,
        riskLevel: 'HIGH' as const,
        decision: 'BLOCK' as const
      };

      cacheService.set(address1, 1, result, CacheTier.MEDIUM);
      cacheService.set(address2, 1, result, CacheTier.MEDIUM);
      
      const cached1Before = cacheService.get(address1, 1);
      const cached2Before = cacheService.get(address2, 1);
      expect(cached1Before).not.toBeNull();
      expect(cached2Before).not.toBeNull();
      
      cacheService.clearAll();
      
      const cached1After = cacheService.get(address1, 1);
      const cached2After = cacheService.get(address2, 1);
      expect(cached1After).toBeNull();
      expect(cached2After).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const result = {
        riskScore: 75,
        riskLevel: 'HIGH' as const,
        decision: 'BLOCK' as const
      };

      const statsBefore = cacheService.getStats();
      expect(statsBefore.keys).toBe(0);
      
      cacheService.set(address, 1, result, CacheTier.MEDIUM);
      cacheService.get(address, 1); // Hit
      cacheService.get('0x0000000000000000000000000000000000000000', 1); // Miss
      
      const statsAfter = cacheService.getStats();
      expect(statsAfter.keys).toBe(1);
      expect(statsAfter.hits).toBeGreaterThan(0);
      expect(statsAfter.misses).toBeGreaterThan(0);
    });
  });

  describe('isInitialized', () => {
    it('should return true when cache is initialized', () => {
      expect(cacheService.isInitialized()).toBe(true);
    });
  });
});