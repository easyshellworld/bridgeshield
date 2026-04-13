import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { AnalyticsService, TransferFilters } from '../../src/services/analytics-service';

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const createMockResponse = (data: unknown) => ({
    ok: true,
    json: async () => data,
    headers: new Map(),
    status: 200,
    statusText: 'OK'
  });

  const createErrorResponse = (status: number, statusText: string) => ({
    ok: false,
    status,
    statusText,
    json: async () => ({ error: `${status} error` }),
    headers: new Map(),
    text: async () => `${status} ${statusText}`
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    analyticsService = new AnalyticsService();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fetchTransfers', () => {
    it('should fetch transfers for a wallet address', async () => {
      const mockData = {
        transfers: [
          {
            id: 'transfer-1',
            fromAddress: '0x1234567890abcdef1234567890abcdef12345678',
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

      const result = await analyticsService.fetchTransfers('0x1234567890abcdef1234567890abcdef12345678');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://li.quest/v2/analytics/transfers?wallet=0x1234567890abcdef1234567890abcdef12345678',
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.transfers).toHaveLength(1);
      expect(result.transfers[0].id).toBe('transfer-1');
    });

    it('should handle pagination with next/previous cursors', async () => {
      const mockData = {
        transfers: [{ id: 'transfer-2', status: 'PENDING' }],
        hasNext: true,
        hasPrevious: false,
        next: 'cursor-123',
        previous: null
      };

      fetchSpy.mockResolvedValueOnce(createMockResponse(mockData) as unknown as Response);

      const result = await analyticsService.fetchTransfers('0x1234567890abcdef1234567890abcdef12345678', { cursor: 'cursor-123' });

      expect(result.hasNext).toBe(true);
      expect(result.next).toBe('cursor-123');
    });

    it('should apply filters (status, time range, chains)', async () => {
      const mockData = { transfers: [], hasNext: false, hasPrevious: false, next: null, previous: null };
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockData) as unknown as Response);

      const filters: TransferFilters = {
        status: 'PENDING',
        fromChain: 1,
        toChain: 137,
        fromTimestamp: '2024-01-01T00:00:00Z',
        toTimestamp: '2024-01-31T23:59:59Z'
      };

      await analyticsService.fetchTransfers('0x1234567890abcdef1234567890abcdef12345678', filters);

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain('status=PENDING');
      expect(url).toContain('fromChain=1');
      expect(url).toContain('toChain=137');
    });

    it('should handle rate limit errors (429)', async () => {
      fetchSpy.mockResolvedValueOnce(createErrorResponse(429, 'Too Many Requests') as unknown as Response);

      await expect(analyticsService.fetchTransfers('0x1234567890abcdef1234567890abcdef12345678')).rejects.toThrow('429');
    });

    it('should handle validation errors (400)', async () => {
      fetchSpy.mockResolvedValueOnce(createErrorResponse(400, 'Bad Request') as unknown as Response);

      await expect(analyticsService.fetchTransfers('0x1234567890abcdef1234567890abcdef12345678')).rejects.toThrow('400');
    });

    it('should handle server errors (500)', async () => {
      fetchSpy.mockResolvedValueOnce(createErrorResponse(500, 'Internal Server Error') as unknown as Response);

      await expect(analyticsService.fetchTransfers('0x1234567890abcdef1234567890abcdef12345678')).rejects.toThrow('500');
    });
  });

  describe('transformResponse', () => {
    it('should transform LI.FI response to internal format', () => {
      const liFiResponse = {
        transfers: [{
          id: 'transfer-3',
          fromAddress: '0x1234567890abcdef1234567890abcdef12345678',
          toAddress: '0x876543210fedcba9876543210fedcba987654321',
          fromChain: 1,
          toChain: 137,
          amount: '3000000000000000000',
          status: 'COMPLETED',
          timestamp: '2024-01-15T12:30:00Z',
          txHash: '0xabc123def456'
        }],
        hasNext: false,
        hasPrevious: false,
        next: null,
        previous: null
      };

      const result = analyticsService.transformResponse(liFiResponse);

      expect(result.transfers[0].id).toBe('transfer-3');
      expect(result.transfers[0].txHash).toBe('0xabc123def456');
      expect(result.hasNext).toBe(false);
    });
  });

  describe('caching', () => {
    it('should cache results for same query', async () => {
      const mockData = { transfers: [{ id: 'cached' }], hasNext: false, hasPrevious: false, next: null, previous: null };
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockData) as unknown as Response);

      const result1 = await analyticsService.fetchTransfers('0x1234567890abcdef1234567890abcdef12345678');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const result2 = await analyticsService.fetchTransfers('0x1234567890abcdef1234567890abcdef12345678');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result2.transfers).toEqual(result1.transfers);
    });

    it('should respect cache TTL (15 minutes)', async () => {
      const mockData = { transfers: [], hasNext: false, hasPrevious: false, next: null, previous: null };
      fetchSpy.mockResolvedValueOnce(createMockResponse(mockData) as unknown as Response);

      await analyticsService.fetchTransfers('0x1234567890abcdef1234567890abcdef12345678');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(16 * 60 * 1000);

      await analyticsService.fetchTransfers('0x1234567890abcdef1234567890abcdef12345678');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('rate limit headers', () => {
    it('should capture rate limit headers', async () => {
      const mockData = { transfers: [], hasNext: false, hasPrevious: false, next: null, previous: null };
      const headers = new Map([
        ['X-RateLimit-Limit', '100'],
        ['X-RateLimit-Remaining', '95'],
        ['X-RateLimit-Reset', '1705334400']
      ]);
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
        headers,
        status: 200,
        statusText: 'OK'
      } as unknown as Response);

      await analyticsService.fetchTransfers('0x1234567890abcdef1234567890abcdef12345678');

      const rateLimitInfo = analyticsService.getRateLimitInfo();
      expect(rateLimitInfo?.limit).toBe(100);
      expect(rateLimitInfo?.remaining).toBe(95);
    });
  });
});
