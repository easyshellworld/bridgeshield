import NodeCache from 'node-cache';
import { logger } from '../api/middleware/logger';

export enum CacheTier {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  WHITELIST = 'WHITELIST',
  FALLBACK = 'FALLBACK'
}

export interface CacheResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK';
  riskType?: string;
  cacheTier: CacheTier;
  cachedAt: Date;
  expiresAt: Date;
}

export class CacheService {
  private static instance: CacheService;
  private cache: NodeCache;
  
  private ttlConfig: Record<CacheTier, number> = {
    [CacheTier.HIGH]: parseInt(process.env.CACHE_TTL_HIGH || '0'),
    [CacheTier.MEDIUM]: parseInt(process.env.CACHE_TTL_MEDIUM || '604800000'),
    [CacheTier.LOW]: parseInt(process.env.CACHE_TTL_LOW || '259200000'),
    [CacheTier.WHITELIST]: parseInt(process.env.CACHE_TTL_WHITELIST || '2592000000'),
    [CacheTier.FALLBACK]: parseInt(process.env.CACHE_TTL_FALLBACK || '300000')
  };
  
  private constructor() {
    this.cache = new NodeCache({
      stdTTL: 0,
      checkperiod: 600,
      useClones: false,
      deleteOnExpire: true
    });
    
    logger.info('Cache service initialized with node-cache (in-memory)');
  }
  
  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }
  
  private getCacheKey(address: string, chainId: number): string {
    const normalizedAddress = address.toLowerCase();
    return `bs:risk:${chainId}:${normalizedAddress}`;
  }
  
  public get(address: string, chainId: number): CacheResult | null {
    const cacheKey = this.getCacheKey(address, chainId);
    const cached = this.cache.get<CacheResult>(cacheKey);
    
    if (cached) {
      logger.debug('Cache hit', { address, chainId, cacheKey });
      return cached;
    }
    
    logger.debug('Cache miss', { address, chainId, cacheKey });
    return null;
  }
  
  public set(
    address: string, 
    chainId: number, 
    result: Omit<CacheResult, 'cachedAt' | 'expiresAt' | 'cacheTier'>,
    tier: CacheTier = CacheTier.MEDIUM
  ): void {
    const cacheKey = this.getCacheKey(address, chainId);
    const ttl = this.ttlConfig[tier];
    
    const cacheEntry: CacheResult = {
      ...result,
      cacheTier: tier,
      cachedAt: new Date(),
      expiresAt: ttl === 0 ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10) : new Date(Date.now() + ttl)
    };
    
    this.cache.set(cacheKey, cacheEntry, ttl === 0 ? 0 : ttl / 1000);
    
    logger.debug('Cache set', { 
      address, 
      chainId, 
      cacheKey, 
      tier, 
      ttl: ttl === 0 ? 'permanent' : `${ttl}ms` 
    });
  }
  
  public clear(address: string, chainId: number): boolean {
    const cacheKey = this.getCacheKey(address, chainId);
    const deleted = this.cache.del(cacheKey) > 0;
    
    if (deleted) {
      logger.debug('Cache cleared', { address, chainId, cacheKey });
    }
    
    return deleted;
  }
  
  public clearAll(): void {
    this.cache.flushAll();
    logger.info('Cache cleared entirely');
  }
  
  public getStats() {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      ksize: stats.ksize,
      vsize: stats.vsize
    };
  }
  
  public isInitialized(): boolean {
    return this.cache !== undefined;
  }
}