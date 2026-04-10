import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

import { PrismaService } from './db/prisma-client';
import { RiskDataLoader } from './data/risk-data-loader';
import { CacheService } from './services/cache-service';
import { logger, requestLogger } from './api/middleware/logger';
import { apiRateLimiter } from './api/middleware/rate-limiter';
import { handleValidationError } from './api/middleware/validator';

import healthRouter from './api/routes/health';
import checkRouter from './api/routes/check';
import whitelistRouter from './api/routes/whitelist';
import appealRouter from './api/routes/appeal';
import adminRouter from './api/routes/admin';

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

const prismaService = PrismaService.getInstance();
const riskDataLoader = RiskDataLoader.getInstance();
const cacheService = CacheService.getInstance();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(requestLogger);

app.use(apiRateLimiter);

app.use(`/api/${API_VERSION}/health`, healthRouter);
app.use(`/api/${API_VERSION}/aml/check`, checkRouter);
app.use(`/api/${API_VERSION}/aml/whitelist`, whitelistRouter);
app.use(`/api/${API_VERSION}/aml/appeal`, appealRouter);
app.use(`/api/${API_VERSION}/admin`, adminRouter);

app.get('/', (req, res) => {
  res.json({
    name: 'BridgeShield Backend API',
    version: '0.0.0',
    description: 'AML risk check API for LI.FI cross-chain transactions',
    endpoints: {
      health: `/api/${API_VERSION}/health`,
      check: `/api/${API_VERSION}/aml/check`,
      whitelist: `/api/${API_VERSION}/aml/whitelist`,
      appeal: `/api/${API_VERSION}/aml/appeal`
    },
    documentation: 'https://docs.bridgeshield.io'
  });
});

app.use(handleValidationError);

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

async function initializeServices() {
  try {
    logger.info('Initializing services...');
    
    await prismaService.connect();
    logger.info('Database connected');
    
    await riskDataLoader.initialize();
    logger.info('Risk data loaded');
    
    logger.info('Cache service initialized');
    
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services', { error });
    process.exit(1);
  }
}

async function startServer() {
  await initializeServices();
  
  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    logger.info(`Server started on port ${PORT}`);
    logger.info(`API version: ${API_VERSION}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Redis: disabled (MVP - using in-memory cache)`);
  });
  
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    server.close(async () => {
      await prismaService.disconnect();
      logger.info('Server shut down gracefully');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    server.close(async () => {
      await prismaService.disconnect();
      logger.info('Server shut down gracefully');
      process.exit(0);
    });
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
  });
  
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    process.exit(1);
  });
  
  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}

export { app, startServer };