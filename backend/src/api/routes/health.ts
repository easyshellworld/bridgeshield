import { Router, Request, Response } from 'express';
import { PrismaService } from '../../db/prisma-client';
import { RiskDataLoader } from '../../data/risk-data-loader';
import { CacheService } from '../../services/cache-service';
import { logger } from '../middleware/logger';

const router = Router();
const prismaService = PrismaService.getInstance();
const riskDataLoader = RiskDataLoader.getInstance();
const cacheService = CacheService.getInstance();

const startTime = Date.now();

router.get('/', async (req: Request, res: Response) => {
  try {
    const uptime = Date.now() - startTime;
    
    const healthChecks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      uptime: `${Math.floor(uptime / 1000)}s`,
      services: {
        database: await checkDatabase(),
        riskData: await checkRiskData(),
        cache: await checkCache(),
        redis: 'disabled (MVP - using in-memory cache)'
      }
    };
    
    const allHealthy = Object.values(healthChecks.services).every(
      service => typeof service === 'string' ? true : service.healthy
    );
    
    if (!allHealthy) {
      healthChecks.status = 'degraded';
      logger.warn('Health check degraded', { healthChecks });
      res.status(200).json(healthChecks);
      return;
    }
    
    logger.debug('Health check passed');
    res.status(200).json(healthChecks);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

async function checkDatabase() {
  try {
    const isConnected = await prismaService.healthCheck();
    return {
      healthy: isConnected,
      status: isConnected ? 'connected' : 'disconnected'
    };
  } catch (error) {
    return {
      healthy: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

async function checkRiskData() {
  try {
    const isInitialized = riskDataLoader.isInitialized();
    if (!isInitialized) {
      await riskDataLoader.initialize();
    }
    
    const stats = riskDataLoader.getStats();
    return {
      healthy: isInitialized,
      status: isInitialized ? 'loaded' : 'loading',
      riskDataCount: stats.totalRiskAddresses,
      whitelistCount: stats.totalWhitelistAddresses
    };
  } catch (error) {
    return {
      healthy: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown risk data error'
    };
  }
}

async function checkCache() {
  try {
    const isInitialized = cacheService.isInitialized();
    const stats = cacheService.getStats();
    return {
      healthy: isInitialized,
      status: isInitialized ? 'ready' : 'initializing',
      stats: {
        keys: stats.keys,
        hits: stats.hits,
        misses: stats.misses
      }
    };
  } catch (error) {
    return {
      healthy: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown cache error'
    };
  }
}

export default router;