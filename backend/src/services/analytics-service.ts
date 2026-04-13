import { PrismaService } from '../db/prisma-client';
import NodeCache from 'node-cache';
import { logger } from '../api/middleware/logger';
import { validateAddress } from '../api/middleware/validator';

export interface Transfer {
  id: string;
  fromAddress: string;
  toAddress: string;
  fromChain: number;
  toChain: number;
  amount: string;
  amountUsd?: number;
  status: string;
  timestamp: string;
  txHash?: string;
  feeAmount?: string;
  feeToken?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore?: number;
}

export interface TransferFilters {
  status?: string;
  fromChain?: number;
  toChain?: number;
  fromTimestamp?: string;
  toTimestamp?: string;
  cursor?: string;
  limit?: number;
}

export interface PaginatedTransfers {
  transfers: Transfer[];
  hasNext: boolean;
  hasPrevious: boolean;
  next: string | null;
  previous: string | null;
  fallbackUsed?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

export class AnalyticsService {
  private prismaService: PrismaService;
  private cache: NodeCache;
  private baseUrl: string;
  private rateLimitInfo: RateLimitInfo | null = null;

  constructor(
    prismaService: PrismaService = PrismaService.getInstance()
  ) {
    this.prismaService = prismaService;
    this.cache = new NodeCache({ stdTTL: 900, checkperiod: 600 });
    this.baseUrl = process.env.LI_FI_API_BASE_URL || 'https://li.quest';
  }

  public async fetchTransfers(
    address: string,
    filters?: TransferFilters
  ): Promise<PaginatedTransfers> {
    const normalizedAddress = address.toLowerCase();
    const cacheKey = this.buildCacheKey(normalizedAddress, filters);

    const cachedResult = this.cache.get<PaginatedTransfers>(cacheKey);
    if (cachedResult) {
      logger.debug('Cache hit for analytics transfers', { address, filters });
      return cachedResult;
    }

    try {
      const url = this.buildUrl(normalizedAddress, filters);
      logger.debug('Fetching transfers from LI.FI API', { url });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      this.updateRateLimitInfo(response);

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('LI.FI API request failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });

        if (response.status === 429) {
          throw new Error(`LI.FI Analytics API rate limit exceeded: ${response.status} ${response.statusText}`);
        } else if (response.status === 400) {
          throw new Error(`LI.FI Analytics API validation error: ${response.status} ${response.statusText}`);
        } else if (response.status >= 500) {
          throw new Error(`LI.FI Analytics API server error: ${response.status} ${response.statusText}`);
        } else {
          throw new Error(`LI.FI Analytics API error: ${response.status} ${response.statusText}`);
        }
      }

      const data = await response.json();
      const transformed = this.transformResponse(data);

      this.cache.set(cacheKey, transformed);

      return transformed;
    } catch (error) {
      if (error instanceof Error && 
          !error.message.includes('rate limit') && 
          !error.message.includes('validation error') && 
          !error.message.includes('server error')) {
        
        logger.warn('LI.FI API failed, falling back to local database', { error });

        try {
          const localTransfers = await this.queryLocalTransfers(normalizedAddress, filters);
          const transformedLocal = this.transformLocalTransfers(localTransfers);

          transformedLocal.fallbackUsed = true;

          this.cache.set(cacheKey, transformedLocal, 300);

          return transformedLocal;
        } catch (fallbackError) {
          logger.error('Both LI.FI API and local fallback failed', { fallbackError });
          throw new Error(`Failed to fetch transfers: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      throw error;
    }
  }

  public transformResponse(liFiResponse: any): PaginatedTransfers {
    const transfers: Transfer[] = (liFiResponse.transfers || []).map((transfer: any) => ({
      id: transfer.id,
      fromAddress: transfer.fromAddress,
      toAddress: transfer.toAddress,
      fromChain: transfer.fromChain,
      toChain: transfer.toChain,
      amount: transfer.amount,
      amountUsd: transfer.amountUsd,
      status: transfer.status,
      timestamp: transfer.timestamp,
      txHash: transfer.txHash,
      feeAmount: transfer.feeAmount,
      feeToken: transfer.feeToken,
      riskLevel: undefined,
      riskScore: undefined
    }));

    return {
      transfers,
      hasNext: liFiResponse.hasNext || false,
      hasPrevious: liFiResponse.hasPrevious || false,
      next: liFiResponse.next || null,
      previous: liFiResponse.previous || null
    };
  }

  public async queryLocalTransfers(address: string, filters?: TransferFilters): Promise<any[]> {
    const normalizedAddress = address.toLowerCase();
    
    const whereClause: any = {
      address: normalizedAddress
    };

    if (filters?.fromTimestamp || filters?.toTimestamp) {
      whereClause.createdAt = {};
      if (filters.fromTimestamp) {
        whereClause.createdAt.gte = new Date(filters.fromTimestamp);
      }
      if (filters.toTimestamp) {
        whereClause.createdAt.lte = new Date(filters.toTimestamp);
      }
    }

    if (filters?.status) {
      whereClause.decision = filters.status.toUpperCase();
    }

    const logs = await this.prismaService.getClient().checkLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50
    });

    return logs.map(log => {
      let requestData: any = {};
      try {
        if (log.requestData) {
          requestData = JSON.parse(log.requestData);
        }
      } catch (e) {
      }

      return {
        id: log.checkId,
        fromAddress: log.address,
        toAddress: log.address,
        fromChain: log.chainId,
        toChain: log.chainId,
        amount: requestData.amount || '0',
        status: log.decision,
        timestamp: log.createdAt.toISOString(),
        riskLevel: log.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH',
        riskScore: log.riskScore
      };
    });
  }

  public getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  private buildCacheKey(address: string, filters?: TransferFilters): string {
    const filterString = filters ? JSON.stringify(filters) : '';
    return `analytics:transfers:${address}:${filterString}`;
  }

  private buildUrl(address: string, filters?: TransferFilters): string {
    const params = new URLSearchParams();
    params.append('wallet', address);

    if (filters?.status) {
      params.append('status', filters.status);
    }
    if (filters?.fromChain) {
      params.append('fromChain', filters.fromChain.toString());
    }
    if (filters?.toChain) {
      params.append('toChain', filters.toChain.toString());
    }
    if (filters?.fromTimestamp) {
      params.append('fromTimestamp', filters.fromTimestamp);
    }
    if (filters?.toTimestamp) {
      params.append('toTimestamp', filters.toTimestamp);
    }
    if (filters?.cursor) {
      params.append('cursor', filters.cursor);
    }
    if (filters?.limit) {
      params.append('limit', filters.limit.toString());
    }

    const queryString = params.toString();
    return `${this.baseUrl}/v2/analytics/transfers${queryString ? `?${queryString}` : ''}`;
  }

  private updateRateLimitInfo(response: Response): void {
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (limit && remaining && reset) {
      this.rateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: parseInt(reset, 10)
      };
    }
  }

  private transformLocalTransfers(localTransfers: any[]): PaginatedTransfers {
    const transfers: Transfer[] = localTransfers.map(transfer => ({
      id: transfer.id,
      fromAddress: transfer.fromAddress,
      toAddress: transfer.toAddress,
      fromChain: transfer.fromChain,
      toChain: transfer.toChain,
      amount: transfer.amount,
      status: transfer.status,
      timestamp: transfer.timestamp,
      riskLevel: transfer.riskLevel,
      riskScore: transfer.riskScore
    }));

    return {
      transfers,
      hasNext: false,
      hasPrevious: false,
      next: null,
      previous: null,
      fallbackUsed: true
    };
  }
}