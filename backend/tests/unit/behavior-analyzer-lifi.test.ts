import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BehaviorAnalyzerService, BehaviorProfile } from '../../src/services/behavior-analyzer';
import { Transfer } from '../../src/services/analytics-service';

describe('BehaviorAnalyzerService - LI.FI Analytics Integration', () => {
  let service: BehaviorAnalyzerService;
  const now = new Date('2026-04-12T00:00:00.000Z');

  const createTransfer = (partial: Partial<Transfer>): Transfer => ({
    id: `tx-${Math.random().toString(36).slice(2)}`,
    fromAddress: '0x1234567890abcdef1234567890abcdef12345678',
    toAddress: '0x876543210fedcba9876543210fedcba987654321',
    fromChain: 1,
    toChain: 137,
    amount: '1000000000000000000',
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    ...partial
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BehaviorAnalyzerService();
  });

  describe('LI.FI History Enhancement', () => {
    it('should increase score when LI.FI history shows high-risk address interactions', async () => {
      const lifiHistory: Transfer[] = [
        createTransfer({
          toAddress: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96',
          amount: '5000000000000000000',
          timestamp: new Date(now.getTime() - 86400000).toISOString()
        }),
        createTransfer({
          toAddress: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96',
          amount: '3000000000000000000',
          timestamp: new Date(now.getTime() - 172800000).toISOString()
        })
      ];

      const localHistory = [];
      const currentInput = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        amount: '1000000'
      };

      const profile = await service.calculateProfile(currentInput, localHistory, now, lifiHistory);

      expect(profile.score).toBeGreaterThan(0);
      expect(profile.lifiSignals?.length).toBeGreaterThan(0);
    });

    it('should increase score when LI.FI history shows amount spike vs historical average', async () => {
      const lifiHistory: Transfer[] = Array.from({ length: 10 }).map((_, i) =>
        createTransfer({
          amount: (BigInt(1000) * BigInt(10 ** 18)).toString(),
          timestamp: new Date(now.getTime() - i * 86400000).toISOString()
        })
      );

      const localHistory = [];
      const currentInput = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        amount: (BigInt(50000) * BigInt(10 ** 18)).toString()
      };

      const profile = await service.calculateProfile(currentInput, localHistory, now, lifiHistory);

      expect(profile.score).toBeGreaterThan(0);
      expect(profile.lifiSignals?.some(s => s.includes('LI.FI'))).toBe(true);
    });

    it('should increase score for first-time LI.FI user with high transaction value', async () => {
      const lifiHistory: Transfer[] = [
        createTransfer({
          amount: (BigInt(100000) * BigInt(10 ** 18)).toString(),
          timestamp: new Date(now.getTime() - 3600000).toISOString()
        })
      ];

      const localHistory = [];
      const currentInput = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 8453,
        amount: (BigInt(100000) * BigInt(10 ** 18)).toString()
      };

      const profile = await service.calculateProfile(currentInput, localHistory, now, lifiHistory);

      expect(profile.score).toBeGreaterThanOrEqual(20);
    });

    it('should NOT override BLOCK decision even with suspicious LI.FI history', async () => {
      const lifiHistory: Transfer[] = [
        createTransfer({
          toAddress: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96',
          amount: (BigInt(1000000) * BigInt(10 ** 18)).toString()
        })
      ];

      const localHistory = [{
        createdAt: new Date(now.getTime() - 86400000),
        chainId: 1,
        decision: 'BLOCK' as const,
        amount: 1
      }];

      const currentInput = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        amount: '1000000'
      };

      const profile = await service.calculateProfile(currentInput, localHistory, now, lifiHistory);

      const adjustment = service.applyBehaviorAdjustment({
        decision: 'BLOCK',
        riskLevel: 'HIGH',
        riskScore: 90
      }, profile);

      expect(adjustment.decision).toBe('BLOCK');
    });

    it('should combine local checkLog and LI.FI history for better confidence', async () => {
      const lifiHistory: Transfer[] = Array.from({ length: 5 }).map((_, i) =>
        createTransfer({
          amount: (BigInt(1000) * BigInt(10 ** 18)).toString(),
          timestamp: new Date(now.getTime() - i * 86400000).toISOString()
        })
      );

      const localHistory = Array.from({ length: 3 }).map((_, i) => ({
        createdAt: new Date(now.getTime() - i * 86400000),
        chainId: 1,
        decision: 'ALLOW' as const,
        amount: 1000
      }));

      const currentInput = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        amount: '1200'
      };

      const profileNoLifi = await service.calculateProfile(currentInput, localHistory, now, []);
      const profileWithLifi = await service.calculateProfile(currentInput, localHistory, now, lifiHistory);

      expect(profileWithLifi.confidence).toBe('HIGH');
    });

    it('should handle empty LI.FI history gracefully', async () => {
      const lifiHistory: Transfer[] = [];
      const localHistory = [{
        createdAt: new Date(now.getTime() - 86400000),
        chainId: 1,
        decision: 'ALLOW' as const,
        amount: 100
      }];

      const currentInput = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        amount: '100'
      };

      const profile = await service.calculateProfile(currentInput, localHistory, now, lifiHistory);

      expect(profile.level).toBe('LOW');
      expect(profile.score).toBeLessThan(30);
    });

    it('should apply LI.FI-based escalation (ALLOW to REVIEW)', async () => {
      const lifiHistory: Transfer[] = Array.from({ length: 20 }).map((_, i) =>
        createTransfer({
          toAddress: i % 3 === 0 ? '0x098B716B8Aaf21512996dC57EB0615e2383E2f96' : createTransfer({}).toAddress,
          amount: (BigInt(10000) * BigInt(10 ** 18)).toString(),
          timestamp: new Date(now.getTime() - i * 3600000).toISOString()
        })
      );

      const localHistory = [];
      const currentInput = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 8453,
        amount: (BigInt(50000) * BigInt(10 ** 18)).toString()
      };

      const profile = await service.calculateProfile(currentInput, localHistory, now, lifiHistory);

      const adjustment = service.applyBehaviorAdjustment({
        decision: 'ALLOW',
        riskLevel: 'LOW',
        riskScore: 0
      }, profile);

      expect(adjustment.decision).toBe('REVIEW');
      expect(adjustment.behaviorEscalated).toBe(true);
    });

    it('should set fallbackUsed flag when LI.FI API fails or returns empty', async () => {
      const lifiHistory: Transfer[] = [];
      const localHistory = [{
        createdAt: new Date(now.getTime() - 86400000),
        chainId: 1,
        decision: 'ALLOW' as const,
        amount: 100
      }];

      const currentInput = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        amount: '100'
      };

      const profile = await service.calculateProfile(currentInput, localHistory, now, lifiHistory);

      expect(profile.metrics.lifiHistoryFallback).toBe(true);
    });
  });

  describe('Risk Signal Extraction from LI.FI', () => {
    it('should detect cross-chain tumbling patterns', async () => {
      const lifiHistory: Transfer[] = Array.from({ length: 10 }).map((_, i) =>
        createTransfer({
          fromChain: (i % 5) + 1,
          toChain: ((i + 1) % 5) + 1,
          amount: (BigInt(1000) * BigInt(10 ** 18)).toString(),
          timestamp: new Date(now.getTime() - i * 3600000).toISOString()
        })
      );

      const localHistory = [];
      const currentInput = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        chainId: 1,
        amount: '1000'
      };

      const profile = await service.calculateProfile(currentInput, localHistory, now, lifiHistory);

      expect(profile.lifiSignals?.some(s => 
        s.toLowerCase().includes('cross-chain') || 
        s.toLowerCase().includes('li.fi')
      )).toBe(true);
    });
  });
});
