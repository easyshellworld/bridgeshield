import { PrismaClient } from '@prisma/client';
import { logger } from '../api/middleware/logger';

export class PrismaService {
  private static instance: PrismaService;
  private prisma: PrismaClient;
  
  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error']
    });
    
    logger.info('Prisma client initialized');
  }
  
  public static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  public static resetInstance(): void {
    if (PrismaService.instance) {
      PrismaService.instance.prisma.$disconnect().catch(() => {});
    }
    PrismaService.instance = undefined as any;
  }
  
  public getClient(): PrismaClient {
    return this.prisma;
  }
  
  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database', { error });
      throw error;
    }
  }
  
  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info('Database disconnected');
    } catch (error) {
      logger.error('Error disconnecting from database', { error });
      throw error;
    }
  }
  
  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }
  
  public async createCheckLog(data: {
    checkId: string;
    address: string;
    chainId: number;
    riskScore: number;
    riskLevel: string;
    decision: string;
    isWhitelisted: boolean;
    cacheHit: boolean;
    fallbackUsed: boolean;
    requestData?: any;
    responseData?: any;
  }) {
    try {
      return await this.prisma.checkLog.create({ 
        data: {
          ...data,
          requestData: data.requestData ? JSON.stringify(data.requestData) : null,
          responseData: data.responseData ? JSON.stringify(data.responseData) : null
        }
      });
    } catch (error) {
      logger.error('Failed to create check log', { error, data });
      throw error;
    }
  }
  
  public async createAppeal(data: {
    ticketId: string;
    address: string;
    chainId: number;
    reason: string;
    contact?: string;
    status?: string;
    estimatedReviewAt?: Date;
  }) {
    try {
      return await this.prisma.appeal.create({ data });
    } catch (error) {
      logger.error('Failed to create appeal', { error, data });
      throw error;
    }
  }
  
  public async createWhitelistEntry(data: {
    address: string;
    chainId: number;
    category: string;
    description?: string;
    expiresAt?: Date;
  }) {
    try {
      return await this.prisma.whitelistEntry.create({ data });
    } catch (error) {
      logger.error('Failed to create whitelist entry', { error, data });
      throw error;
    }
  }
  
  public async createAuditLog(data: {
    action: string;
    entityType: string;
    entityId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }) {
    try {
      return await this.prisma.auditLog.create({ 
        data: {
          ...data,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null
        }
      });
    } catch (error) {
      logger.error('Failed to create audit log', { error, data });
    }
  }
}