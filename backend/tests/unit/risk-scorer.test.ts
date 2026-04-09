import { describe, it, expect, beforeAll } from 'vitest';
import { RiskScorer, RiskScoreInput, RiskScoreResult } from '../../src/services/risk-scorer';
import { RiskDataLoader } from '../../src/data/risk-data-loader';

describe('RiskScorer', () => {
  let riskScorer: RiskScorer;
  let riskDataLoader: RiskDataLoader;

  beforeAll(async () => {
    riskScorer = new RiskScorer();
    riskDataLoader = RiskDataLoader.getInstance();
    await riskDataLoader.initialize();
  });

  describe('calculateRiskScore', () => {
    it('should return LOW risk for clean address', () => {
      const input: RiskScoreInput = {
        address: '0x0000000000000000000000000000000000000001',
        chainId: 1
      };
      
      const result = riskScorer.calculateRiskScore(input);
      
      expect(result.riskScore).toBe(0);
      expect(result.riskLevel).toBe('LOW');
      expect(result.decision).toBe('ALLOW');
      expect(result.isSanctioned).toBe(false);
      expect(result.factors.baseRisk).toBe(0);
      expect(result.factors.details).toContain('No direct risk data found');
    });

    it('should return HIGH/BLOCK for HACKER address', () => {
      const input: RiskScoreInput = {
        address: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96', // Ronin hacker
        chainId: 1
      };
      
      const result = riskScorer.calculateRiskScore(input);
      
      expect(result.riskScore).toBe(75);
      expect(result.riskLevel).toBe('HIGH');
      expect(result.decision).toBe('BLOCK');
      expect(result.isSanctioned).toBe(false);
      expect(result.riskType).toBe('HACKER');
      expect(result.factors.baseRisk).toBe(75);
      expect(result.factors.details).toContain('Base risk: HACKER (+75)');
    });

    it('should return HIGH/BLOCK for MIXER address', () => {
      const input: RiskScoreInput = {
        address: '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b', // Tornado Cash
        chainId: 1
      };
      
      const result = riskScorer.calculateRiskScore(input);
      
      expect(result.riskScore).toBe(70);
      expect(result.riskLevel).toBe('HIGH');
      expect(result.decision).toBe('BLOCK');
      expect(result.isSanctioned).toBe(false);
      expect(result.riskType).toBe('MIXER');
      expect(result.factors.baseRisk).toBe(70);
    });

    it('should add +35 for mixer interaction', () => {
      const input: RiskScoreInput = {
        address: '0x0000000000000000000000000000000000000001',
        chainId: 1,
        hasMixerInteraction: true
      };
      
      const result = riskScorer.calculateRiskScore(input);
      
      expect(result.riskScore).toBe(35);
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.decision).toBe('REVIEW');
      expect(result.factors.behaviorAdjustment).toBe(35);
      expect(result.factors.details).toContain('Mixer interaction: +35');
    });

    it('should add +25 for high risk sender', () => {
      const input: RiskScoreInput = {
        address: '0x0000000000000000000000000000000000000001',
        chainId: 1,
        isHighRiskSender: true
      };
      
      const result = riskScorer.calculateRiskScore(input);
      
      expect(result.riskScore).toBe(25);
      expect(result.riskLevel).toBe('LOW'); // 25 < 31
      expect(result.decision).toBe('ALLOW');
      expect(result.factors.behaviorAdjustment).toBe(25);
      expect(result.factors.details).toContain('High-risk sender: +25');
    });

    it('should add +10 for large amount (> 1,000,000)', () => {
      const input: RiskScoreInput = {
        address: '0x0000000000000000000000000000000000000001',
        chainId: 1,
        amount: '2000000'
      };
      
      const result = riskScorer.calculateRiskScore(input);
      
      expect(result.riskScore).toBe(10);
      expect(result.riskLevel).toBe('LOW');
      expect(result.decision).toBe('ALLOW');
      expect(result.factors.contextAdjustment).toBe(10);
      expect(result.factors.details).toContain('Large amount: +10');
    });

    it('should not add large amount adjustment for small amount', () => {
      const input: RiskScoreInput = {
        address: '0x0000000000000000000000000000000000000001',
        chainId: 1,
        amount: '500000'
      };
      
      const result = riskScorer.calculateRiskScore(input);
      
      expect(result.riskScore).toBe(0);
      expect(result.factors.contextAdjustment).toBe(0);
    });

    it('should handle invalid amount string gracefully', () => {
      const input: RiskScoreInput = {
        address: '0x0000000000000000000000000000000000000001',
        chainId: 1,
        amount: 'invalid'
      };
      
      const result = riskScorer.calculateRiskScore(input);
      
      expect(result.riskScore).toBe(0);
      expect(result.factors.contextAdjustment).toBe(0);
    });

    it('should cap score at maximum (100)', () => {
      const input: RiskScoreInput = {
        address: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96', // HACKER (+75)
        chainId: 1,
        hasMixerInteraction: true, // +35 = 110, should cap at 100
        isHighRiskSender: true, // +25 = 135, should cap at 100
        amount: '2000000' // +10 = 145, should cap at 100
      };
      
      const result = riskScorer.calculateRiskScore(input);
      
      expect(result.riskScore).toBe(100);
      expect(result.riskLevel).toBe('HIGH');
      expect(result.decision).toBe('BLOCK');
      expect(result.factors.baseRisk).toBe(75);
      expect(result.factors.behaviorAdjustment).toBe(60); // 35 + 25
      expect(result.factors.contextAdjustment).toBe(10);
    });

    it('should combine multiple factors correctly', () => {
      const input: RiskScoreInput = {
        address: '0x0000000000000000000000000000000000000001',
        chainId: 1,
        hasMixerInteraction: true,
        isHighRiskSender: true,
        amount: '2000000'
      };
      
      const result = riskScorer.calculateRiskScore(input);
      
      expect(result.riskScore).toBe(70); // 35 + 25 + 10 = 70
      expect(result.riskLevel).toBe('HIGH'); // 70 >= 70
      expect(result.decision).toBe('BLOCK');
      expect(result.factors.behaviorAdjustment).toBe(60); // 35 + 25
      expect(result.factors.contextAdjustment).toBe(10);
    });

    it('should handle address case insensitivity', () => {
      const lowercaseHacker = '0x098b716b8aaf21512996dc57eb0615e2383e2f96';
      const uppercaseHacker = '0x098B716B8AAF21512996DC57EB0615E2383E2F96';
      
      const result1 = riskScorer.calculateRiskScore({
        address: lowercaseHacker,
        chainId: 1
      });
      
      const result2 = riskScorer.calculateRiskScore({
        address: uppercaseHacker,
        chainId: 1
      });
      
      expect(result1.riskScore).toBe(result2.riskScore);
      expect(result1.riskLevel).toBe(result2.riskLevel);
      expect(result1.decision).toBe(result2.decision);
    });

    describe('risk thresholds', () => {
      it('should return LOW/ALLOW for score 0-30', () => {
        const input: RiskScoreInput = {
          address: '0x0000000000000000000000000000000000000001',
          chainId: 1,
          isHighRiskSender: true // +25 = 25 (LOW)
        };
        
        const result = riskScorer.calculateRiskScore(input);
        expect(result.riskLevel).toBe('LOW');
        expect(result.decision).toBe('ALLOW');
      });

      it('should return MEDIUM/REVIEW for score 31##-69', () => {
        const input: RiskScoreInput = {
          address: '0x0000000000000000000000000000000000000001',
          chainId: 1,
          hasMixerInteraction: true // +35 = 35 (MEDIUM)
        };
        
        const result = riskScorer.calculateRiskScore(input);
        expect(result.riskLevel).toBe('MEDIUM');
        expect(result.decision).toBe('REVIEW');
      });

      it('should return HIGH/BLOCK for score >=70', () => {
        const input: RiskScoreInput = {
          address: '0x0000000000000000000000000000000000000001',
          chainId: 1,
          hasMixerInteraction: true,
          isHighRiskSender: true,
          amount: '2000000' // 35 + 25 + 10 = 70 (HIGH)
        };
        
        const result = riskScorer.calculateRiskScore(input);
        expect(result.riskLevel).toBe('HIGH');
        expect(result.decision).toBe('BLOCK');
      });
    });

    describe('sanction logic', () => {
      it('should force HIGH/BLOCK when isSanctioned is true', () => {
        // Test the internal logic by mocking or checking the method directly
        const riskScorerInstance = new RiskScorer();
        
        // Test determineRiskLevel with isSanctioned = true
        const riskLevel = (riskScorerInstance as any).determineRiskLevel(0, true);
        expect(riskLevel).toBe('HIGH');
        
        // Test determineDecision with isSanctioned = true
        const decision = (riskScorerInstance as any).determineDecision('LOW', true);
        expect(decision).toBe('BLOCK');
      });
    });
  });

  describe('getRiskThresholds', () => {
    it('should return threshold values', () => {
      const thresholds = riskScorer.getRiskThresholds();
      
      expect(thresholds.HIGH).toBe(70);
      expect(thresholds.MEDIUM).toBe(31);
      expect(thresholds.MAX_SCORE).toBe(100);
    });
  });

  describe('getBaseRiskScores', () => {
    it('should return base risk scores', () => {
      const baseScores = riskScorer.getBaseRiskScores();
      
      expect(baseScores.SANCTION).toBe(85);
      expect(baseScores.HACKER).toBe(75);
      expect(baseScores.MIXER).toBe(70);
      expect(baseScores.SCAM).toBe(55);
    });
  });
});