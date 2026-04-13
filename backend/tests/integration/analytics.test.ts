import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { PrismaService } from '../../src/db/prisma-client';

let app: Express;
let uniqueCounter = 0;
let fetchSpy: ReturnType<typeof vi.spyOn>;

const createUniqueAddress = () => {
  uniqueCounter += 1;
  return `0x${(Date.now() + uniqueCounter).toString(16).padStart(40, '0')}`.slice(0, 42);
};

const createMockResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
  headers: new Map()
});

const createErrorResponse = (status: number, statusText: string) => ({
  ok: false,
  status,
  statusText,
  json: async () => ({ error: `${status} error` }),
  text: async () => `${status} ${statusText}`,
  headers: new Map()
});

beforeAll(async () => {
  const prisma = PrismaService.getInstance();
  await prisma.connect();
  const mod = await import('../../src/app');
  app = mod.app;
  
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterAll(async () => {
  const { PrismaService } = await import('../../src/db/prisma-client');
  await PrismaService.getInstance().disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

describe('GET /api/v1/analytics/transfers', () => {
  describe('200 success responses', () => {
    it('should return 200 with transfer data when wallet is provided', async () => {
      const walletAddress = createUniqueAddress();
      
      const mockData = {
        transfers: [
          {
            id: 'transfer-1',
            fromAddress: walletAddress,
            toAddress: '0x876543210fedcba9876543210fedcba987654321',
            fromChain: 1,
            toChain: 137,
            amount: '1000000000000000000',
            status: 'COMPLETED',
            timestamp: '2024-01-15T10:30:00Z'
          }
        ],
        hasNext: false,
        hasPrevious: false,
        next: null,
        previous: null
      };

      fetchSpy.mockResolvedValueOnce(createMockResponse(mockData) as unknown as Response);

      const res = await request(app)
        .get('/api/v1/analytics/transfers')
        .query({ wallet: walletAddress });

      expect(res.status).toBe(200);
      expect(res.body.transfers).toHaveLength(1);
      expect(res.body.transfers[0].id).toBe('transfer-1');
    });

    it('should apply status filter when status parameter is provided', async () => {
      const walletAddress = createUniqueAddress();
      
      const mockData = {
        transfers: [{ id: 'transfer-2', status: 'PENDING' }],
        hasNext: false,
        hasPrevious: false,
        next: null,
        previous: null
      };

      fetchSpy.mockResolvedValueOnce(createMockResponse(mockData) as unknown as Response);

      const res = await request(app)
        .get('/api/v1/analytics/transfers')
        .query({ wallet: walletAddress, status: 'PENDING' });

      expect(res.status).toBe(200);
      expect(res.body.transfers[0].status).toBe('PENDING');
    });

    it('should apply time filters when fromTime and toTime parameters are provided', async () => {
      const walletAddress = createUniqueAddress();
      const mockData = { transfers: [], hasNext: false, hasPrevious: false, next: null, previous: null };

      fetchSpy.mockResolvedValueOnce(createMockResponse(mockData) as unknown as Response);

      const res = await request(app)
        .get('/api/v1/analytics/transfers')
        .query({ wallet: walletAddress, fromTime: '2024-01-01T00:00:00Z', toTime: '2024-01-31T23:59:59Z' });

      expect(res.status).toBe(200);
    });

    it('should apply pagination limit when limit parameter is provided', async () => {
      const walletAddress = createUniqueAddress();
      
      const mockData = {
        transfers: [{ id: 'transfer-3' }],
        hasNext: true,
        hasPrevious: false,
        next: 'cursor-123',
        previous: null
      };

      fetchSpy.mockResolvedValueOnce(createMockResponse(mockData) as unknown as Response);

      const res = await request(app)
        .get('/api/v1/analytics/transfers')
        .query({ wallet: walletAddress, limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body.hasNext).toBe(true);
      expect(res.body.next).toBe('cursor-123');
    });
  });

  describe('400 error responses', () => {
    it('should return 400 when wallet parameter is missing', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/transfers');

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 when wallet address is invalid', async () => {
      const res = await request(app)
        .get('/api/v1/analytics/transfers')
        .query({ wallet: 'invalid-address' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('502 upstream error handling', () => {
    it('should return 502 when LI.FI API returns 500 error', async () => {
      const walletAddress = createUniqueAddress();
      
      fetchSpy.mockResolvedValueOnce(createErrorResponse(500, 'Internal Server Error') as unknown as Response);

      const res = await request(app)
        .get('/api/v1/analytics/transfers')
        .query({ wallet: walletAddress });

      expect(res.status).toBe(502);
    });

    it('should fallback to local DB when LI.FI API times out', async () => {
      const walletAddress = createUniqueAddress();
      
      fetchSpy.mockRejectedValueOnce(new Error('Network timeout'));

      const res = await request(app)
        .get('/api/v1/analytics/transfers')
        .query({ wallet: walletAddress });

      expect(res.status).toBe(200);
      expect(res.body._bridgeShield?.fallbackUsed).toBe(true);
    });
  });

  describe('429 rate limit handling', () => {
    it('should return 429 when LI.FI API rate limits us', async () => {
      const walletAddress = createUniqueAddress();
      const headers = new Map([
        ['X-RateLimit-Limit', '100'],
        ['X-RateLimit-Remaining', '0'],
        ['X-RateLimit-Reset', '1705334400']
      ]);
      
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: 'Rate limit exceeded' }),
        text: async () => '429 Too Many Requests',
        headers
      } as unknown as Response);

      const res = await request(app)
        .get('/api/v1/analytics/transfers')
        .query({ wallet: walletAddress });

      expect(res.status).toBe(429);
    });
  });

  describe('caching behavior', () => {
    it('should cache responses for identical queries', async () => {
      const walletAddress = createUniqueAddress();
      
      const mockData = {
        transfers: [{ id: 'cached' }],
        hasNext: false,
        hasPrevious: false,
        next: null,
        previous: null
      };

      fetchSpy.mockResolvedValue(createMockResponse(mockData) as unknown as Response);

      const res1 = await request(app)
        .get('/api/v1/analytics/transfers')
        .query({ wallet: walletAddress });

      expect(res1.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const res2 = await request(app)
        .get('/api/v1/analytics/transfers')
        .query({ wallet: walletAddress });

      expect(res2.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
