import { describe, expect, it } from 'vitest';
import { BehaviorAnalyzerService, BehaviorHistorySample, BehaviorProfile } from '../../src/services/behavior-analyzer';

describe('BehaviorAnalyzerService', () => {
  const service = new BehaviorAnalyzerService();
  const now = new Date('2026-04-11T00:00:00.000Z');

  const historySample = (partial: Partial<BehaviorHistorySample>): BehaviorHistorySample => ({
    createdAt: new Date('2026-04-10T00:00:00.000Z'),
    chainId: 1,
    decision: 'ALLOW',
    amount: 100,
    ...partial
  });

  it('returns LOW behavior level for stable normal activity', () => {
    const history: BehaviorHistorySample[] = [
      historySample({ createdAt: new Date('2026-04-10T23:00:00.000Z'), amount: 95 }),
      historySample({ createdAt: new Date('2026-04-10T12:00:00.000Z'), amount: 105 }),
      historySample({ createdAt: new Date('2026-04-09T12:00:00.000Z'), amount: 100 })
    ];

    const profile = service.calculateProfile({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: 1,
      amount: '100'
    }, history, now);

    expect(profile.level).toBe('LOW');
    expect(profile.score).toBeLessThan(30);
  });

  it('returns HIGH behavior level for anomalous C-end behavior pattern', () => {
    const highVelocityHistory: BehaviorHistorySample[] = Array.from({ length: 24 }).map((_, idx) =>
      historySample({
        createdAt: new Date(now.getTime() - idx * 30 * 60 * 1000),
        chainId: 1,
        amount: 100 + (idx % 3),
        decision: idx % 2 === 0 ? 'REVIEW' : 'ALLOW'
      })
    );

    const profile = service.calculateProfile({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: 8453,
      amount: '5000'
    }, highVelocityHistory, now);

    expect(profile.level).toBe('HIGH');
    expect(profile.score).toBeGreaterThanOrEqual(60);
    expect(profile.signals.length).toBeGreaterThan(0);
  });

  it('escalates ALLOW to REVIEW when behavior level is MEDIUM/HIGH', () => {
    const profile: BehaviorProfile = {
      score: 45,
      level: 'MEDIUM',
      confidence: 'MEDIUM',
      signals: ['Amount spike detected'],
      recommendation: 'Behavior anomaly detected. Require manual review before execution.',
      asOf: now.toISOString(),
      metrics: {
        checks24h: 8,
        checks7d: 12,
        uniqueChains7d: 2,
        seenOnCurrentChainBefore: true,
        currentAmount: 2000,
        avgAmount7d: 100,
        maxAmount7d: 150,
        amountSpikeRatio: 20,
        recentRiskDecisionRatio: 0.1
      },
      adjustments: {
        velocity: 0,
        chainNovelty: 0,
        amount: 45,
        decisionDrift: 0
      }
    };

    const adjustment = service.applyBehaviorAdjustment({
      decision: 'ALLOW',
      riskLevel: 'LOW',
      riskScore: 0
    }, profile);

    expect(adjustment.decision).toBe('REVIEW');
    expect(adjustment.behaviorEscalated).toBe(true);
  });

  it('does not override BLOCK decisions', () => {
    const profile = service.calculateProfile({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chainId: 8453,
      amount: '99999'
    }, [historySample({ decision: 'BLOCK', amount: 1 })], now);

    const adjustment = service.applyBehaviorAdjustment({
      decision: 'BLOCK',
      riskLevel: 'HIGH',
      riskScore: 90
    }, profile);

    expect(adjustment.decision).toBe('BLOCK');
    expect(adjustment.behaviorEscalated).toBe(false);
  });
});
