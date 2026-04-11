import CircuitBreaker from 'opossum';
import { logger } from '../api/middleware/logger';

export interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
  name?: string;
  group?: string;
}

export interface CircuitBreakerResult {
  success: boolean;
  data?: unknown;
  error?: string;
  fallback?: boolean;
  latency?: number;
}

export class CircuitBreakerService {
  private static instance: CircuitBreakerService;
  private breakers: Map<string, CircuitBreaker> = new Map();
  
  private defaultOptions: CircuitBreakerOptions = {
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '3000'),
    errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD || '50'),
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'),
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    name: 'default',
    group: 'risk-check'
  };
  
  private constructor() {
    logger.info('Circuit breaker service initialized');
  }
  
  public static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService.instance) {
      CircuitBreakerService.instance = new CircuitBreakerService();
    }
    return CircuitBreakerService.instance;
  }
  
  public createBreaker<T>(
    action: (...args: unknown[]) => Promise<T>,
    options: CircuitBreakerOptions = {},
    fallback?: (...args: unknown[]) => Promise<unknown>
  ): CircuitBreaker {
    const breakerOptions = { ...this.defaultOptions, ...options };
    const breakerName = breakerOptions.name || 'unnamed';
    
    const breaker = new CircuitBreaker(action, breakerOptions);
    
    if (fallback) {
      breaker.fallback(fallback);
    } else {
      breaker.fallback(() => this.defaultFallback());
    }
    
    this.setupEventListeners(breaker, breakerName);
    this.breakers.set(breakerName, breaker);
    
    logger.debug('Circuit breaker created', { name: breakerName, options: breakerOptions });
    
    return breaker;
  }
  
  private setupEventListeners(breaker: CircuitBreaker, name: string): void {
    breaker.on('open', () => {
      logger.warn('Circuit breaker opened', { name });
    });
    
    breaker.on('close', () => {
      logger.info('Circuit breaker closed', { name });
    });
    
    breaker.on('halfOpen', () => {
      logger.info('Circuit breaker half-open', { name });
    });
    
    breaker.on('failure', (error: Error) => {
      logger.error('Circuit breaker failure', { name, error: error.message });
    });
    
    breaker.on('timeout', (error: Error) => {
      logger.warn('Circuit breaker timeout', { name, error: error.message });
    });
    
    breaker.on('success', (_result: unknown) => {
      logger.debug('Circuit breaker success', { name });
    });
    
    breaker.on('fallback', (_result: unknown) => {
      logger.warn('Circuit breaker fallback used', { name });
    });
  }
  
  private async defaultFallback(): Promise<CircuitBreakerResult> {
    return {
      success: true,
      data: {
        riskScore: 50,
        riskLevel: 'MEDIUM' as const,
        decision: 'REVIEW' as const,
        fallback: true,
        message: 'Circuit breaker fallback - please review transaction'
      },
      fallback: true
    };
  }
  
  public async execute<T>(
    action: (...args: unknown[]) => Promise<T>,
    args: unknown[] = [],
    options: CircuitBreakerOptions = {},
    fallback?: (...args: unknown[]) => Promise<unknown>
  ): Promise<CircuitBreakerResult> {
    const startTime = Date.now();
    const breakerName = options.name || 'anonymous';
    
    let breaker = this.breakers.get(breakerName);
    
    if (!breaker) {
      breaker = this.createBreaker(action, options, fallback);
    }
    
    try {
      const result = await breaker.fire(...args);
      const latency = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Circuit breaker execution failed', {
        name: breakerName,
        error: errorMessage,
        latency
      });
      
      return {
        success: false,
        error: errorMessage,
        latency
      };
    }
  }
  
  public getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }
  
  public getStats(name?: string) {
    if (name) {
      const breaker = this.breakers.get(name);
      return breaker ? breaker.stats : null;
    }
    
    const stats: Record<string, unknown> = {};
    this.breakers.forEach((breaker, breakerName) => {
      stats[breakerName] = breaker.stats;
    });
    
    return stats;
  }
  
  public getStatus(name?: string) {
    if (name) {
      const breaker = this.breakers.get(name);
      return breaker ? {
        closed: breaker.closed,
        opened: breaker.opened,
        halfOpen: breaker.halfOpen,
        pendingClose: breaker.pendingClose,
        isShutdown: breaker.shutdown
      } : null;
    }
    
    const statuses: Record<string, unknown> = {};
    this.breakers.forEach((breaker, breakerName) => {
      statuses[breakerName] = {
        closed: breaker.closed,
        opened: breaker.opened,
        halfOpen: breaker.halfOpen,
        pendingClose: breaker.pendingClose,
        isShutdown: breaker.shutdown
      };
    });
    
    return statuses;
  }
  
  public shutdown(name?: string): void {
    if (name) {
      const breaker = this.breakers.get(name);
      if (breaker) {
        breaker.shutdown();
        this.breakers.delete(name);
        logger.info('Circuit breaker shutdown', { name });
      }
    } else {
      this.breakers.forEach((breaker, breakerName) => {
        breaker.shutdown();
        logger.info('Circuit breaker shutdown', { name: breakerName });
      });
      this.breakers.clear();
    }
  }
}