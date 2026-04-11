import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RiskDataLoader } from '../../data/risk-data-loader';
import { CacheService, CacheTier } from '../../services/cache-service';
import { RiskScorer, RiskScoreInput } from '../../services/risk-scorer';
import { BehaviorAnalyzerService } from '../../services/behavior-analyzer';
import { CircuitBreakerService } from '../../services/circuit-breaker';
import { PrismaService } from '../../db/prisma-client';
import { logger } from '../middleware/logger';
import { riskCheckValidator } from '../middleware/validator';
import { checkRateLimiter } from '../middleware/rate-limiter';

interface RiskCheckResponse {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK';
  factors: {
    details: string[];
  };
  isSanctioned?: boolean;
  riskType?: string;
}

const router = Router();
const riskDataLoader = RiskDataLoader.getInstance();
const cacheService = CacheService.getInstance();
const riskScorer = new RiskScorer();
const behaviorAnalyzer = new BehaviorAnalyzerService();
const circuitBreakerService = CircuitBreakerService.getInstance();
const prismaService = PrismaService.getInstance();

router.post('/', checkRateLimiter, riskCheckValidator, async (req: Request, res: Response) => {
  try {
    const { address, chainId, amount, senderAddress } = req.body;
    const checkId = `chk_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${uuidv4().slice(0, 8)}`;
    
    const normalizedAddress = address.toLowerCase();
    const normalizedSender = senderAddress ? senderAddress.toLowerCase() : undefined;
    
    let cacheHit = false;
    let fallbackUsed = false;
    let isWhitelisted = false;
    const behaviorProfile = await behaviorAnalyzer.analyzeAddressBehavior({
      address: normalizedAddress,
      chainId,
      amount
    });
    
    const cachedResult = cacheService.get(normalizedAddress, chainId);
    
    if (cachedResult) {
      cacheHit = true;
      const adjustedResult = behaviorAnalyzer.applyBehaviorAdjustment({
        riskScore: cachedResult.riskScore,
        riskLevel: cachedResult.riskLevel,
        decision: cachedResult.decision
      }, behaviorProfile);
      
      prismaService.createCheckLog({
        checkId,
        address: normalizedAddress,
        chainId,
        riskScore: adjustedResult.riskScore,
        riskLevel: adjustedResult.riskLevel,
        decision: adjustedResult.decision,
        isWhitelisted,
        cacheHit: true,
        fallbackUsed: false,
        requestData: req.body,
        responseData: {
          ...cachedResult,
          behavior: behaviorProfile,
          behaviorEscalated: adjustedResult.behaviorEscalated,
          behaviorReason: adjustedResult.behaviorReason,
          baseDecision: cachedResult.decision
        }
      }).catch(err => logger.error('Failed to log cached check', { err }));
      
      logger.info('Risk check completed (cached)', {
        checkId,
        address: normalizedAddress,
        chainId,
        riskScore: adjustedResult.riskScore,
        decision: adjustedResult.decision,
        behaviorLevel: behaviorProfile.level,
        behaviorEscalated: adjustedResult.behaviorEscalated,
        cacheTier: cachedResult.cacheTier
      });
      
      res.json({
        checkId,
        address: normalizedAddress,
        chainId,
        riskScore: adjustedResult.riskScore,
        riskLevel: adjustedResult.riskLevel,
        decision: adjustedResult.decision,
        baseDecision: cachedResult.decision,
        riskType: cachedResult.riskType,
        isWhitelisted,
        cacheHit: true,
        cacheTier: cachedResult.cacheTier,
        cachedAt: cachedResult.cachedAt,
        expiresAt: cachedResult.expiresAt,
        behavior: behaviorProfile,
        behaviorEscalated: adjustedResult.behaviorEscalated,
        behaviorReason: adjustedResult.behaviorReason
      });
      return;
    }
    
    isWhitelisted = riskDataLoader.isWhitelisted(normalizedAddress);
    
    if (isWhitelisted) {
      const adjustedResult = behaviorAnalyzer.applyBehaviorAdjustment({
        riskScore: 0,
        riskLevel: 'LOW',
        decision: 'ALLOW'
      }, behaviorProfile);
      const whitelistResult = {
        riskScore: adjustedResult.riskScore,
        riskLevel: adjustedResult.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH',
        decision: adjustedResult.decision as 'ALLOW' | 'REVIEW' | 'BLOCK',
        riskType: undefined,
        isWhitelisted: true,
        behavior: behaviorProfile,
        behaviorEscalated: adjustedResult.behaviorEscalated,
        behaviorReason: adjustedResult.behaviorReason
      };
      
      cacheService.set(
        normalizedAddress,
        chainId,
        {
          riskScore: 0,
          riskLevel: 'LOW',
          decision: 'ALLOW'
        },
        CacheTier.WHITELIST
      );
      
      prismaService.createCheckLog({
        checkId,
        address: normalizedAddress,
        chainId,
        riskScore: adjustedResult.riskScore,
        riskLevel: adjustedResult.riskLevel,
        decision: adjustedResult.decision,
        isWhitelisted: true,
        cacheHit: false,
        fallbackUsed: false,
        requestData: req.body,
        responseData: whitelistResult
      }).catch(err => logger.error('Failed to log whitelist check', { err }));
      
        logger.info('Risk check completed (whitelisted)', {
          checkId,
          address: normalizedAddress,
          chainId,
          decision: adjustedResult.decision,
          behaviorLevel: behaviorProfile.level,
          behaviorEscalated: adjustedResult.behaviorEscalated
        });
      
      res.json({
        checkId,
        address: normalizedAddress,
        chainId,
        riskScore: adjustedResult.riskScore,
        riskLevel: adjustedResult.riskLevel,
        decision: adjustedResult.decision,
        baseDecision: 'ALLOW',
        isWhitelisted: true,
        cacheHit: false,
        behavior: behaviorProfile,
        behaviorEscalated: adjustedResult.behaviorEscalated,
        behaviorReason: adjustedResult.behaviorReason
      });
      return;
    }
    
    const riskCheckAction = async (): Promise<any> => {
      const riskData = riskDataLoader.lookup(normalizedAddress);
      const senderRiskData = normalizedSender ? riskDataLoader.lookup(normalizedSender) : null;
      
      const input: RiskScoreInput = {
        address: normalizedAddress,
        chainId,
        amount,
        senderAddress: normalizedSender,
        hasMixerInteraction: riskData?.risk_type === 'MIXER',
        isHighRiskSender: senderRiskData !== null
      };
      
      const result = riskScorer.calculateRiskScore(input);
      
      let cacheTier = CacheTier.MEDIUM;
      if (result.riskLevel === 'HIGH') cacheTier = CacheTier.HIGH;
      if (result.riskLevel === 'LOW') cacheTier = CacheTier.LOW;
      
      cacheService.set(
        normalizedAddress,
        chainId,
        {
          riskScore: result.riskScore,
          riskLevel: result.riskLevel,
          decision: result.decision,
          riskType: result.riskType
        },
        cacheTier
      );
      
      return {
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        decision: result.decision,
        riskType: result.riskType,
        factors: result.factors,
        isSanctioned: result.isSanctioned
      };
    };
    
    const circuitResult = await circuitBreakerService.execute(
      riskCheckAction,
      [],
      { name: `risk-check-${checkId}` }
    );
    
    if (!circuitResult.success || circuitResult.fallback) {
      fallbackUsed = true;
      
      const fallbackResult = {
        riskScore: 0,
        riskLevel: 'LOW' as const,
        decision: 'ALLOW' as const,
        fallback: true,
        behavior: behaviorProfile
      };
      
      cacheService.set(
        normalizedAddress,
        chainId,
        {
          riskScore: 0,
          riskLevel: 'LOW',
          decision: 'ALLOW'
        },
        CacheTier.FALLBACK
      );
      
      prismaService.createCheckLog({
        checkId,
        address: normalizedAddress,
        chainId,
        riskScore: 0,
        riskLevel: 'LOW',
        decision: 'ALLOW',
        isWhitelisted: false,
        cacheHit: false,
        fallbackUsed: true,
        requestData: req.body,
        responseData: fallbackResult
      }).catch(err => logger.error('Failed to log fallback check', { err }));
      
      logger.warn('Risk check completed (fallback)', {
        checkId,
        address: normalizedAddress,
        chainId,
        error: circuitResult.error,
        fallback: true
      });
      
      res.json({
        checkId,
        address: normalizedAddress,
        chainId,
        riskScore: 0,
        riskLevel: 'LOW',
        decision: 'ALLOW',
        fallback: true,
        fallbackReason: circuitResult.error || 'Circuit breaker triggered',
        behavior: behaviorProfile
      });
      return;
    }
    
    const result = circuitResult.data as RiskCheckResponse;
    const adjustedResult = behaviorAnalyzer.applyBehaviorAdjustment({
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      decision: result.decision
    }, behaviorProfile);
    const behaviorSignals = behaviorProfile.signals.map((signal) => `Behavior: ${signal}`);
    const mergedFactors = {
      ...result.factors,
      details: [...result.factors.details, ...behaviorSignals]
    };
    
    prismaService.createCheckLog({
      checkId,
      address: normalizedAddress,
      chainId,
      riskScore: adjustedResult.riskScore,
      riskLevel: adjustedResult.riskLevel,
      decision: adjustedResult.decision,
      isWhitelisted: false,
      cacheHit: false,
      fallbackUsed: false,
      requestData: req.body,
      responseData: {
        ...result,
        factors: mergedFactors,
        baseDecision: result.decision,
        behavior: behaviorProfile,
        behaviorEscalated: adjustedResult.behaviorEscalated,
        behaviorReason: adjustedResult.behaviorReason
      }
    }).catch(err => logger.error('Failed to log check', { err }));
    
    logger.info('Risk check completed', {
      checkId,
      address: normalizedAddress,
      chainId,
      riskScore: adjustedResult.riskScore,
      riskLevel: adjustedResult.riskLevel,
      decision: adjustedResult.decision,
      baseDecision: result.decision,
      behaviorLevel: behaviorProfile.level,
      behaviorEscalated: adjustedResult.behaviorEscalated,
      isSanctioned: result.isSanctioned
    });
    
    const response = {
      checkId,
      address: normalizedAddress,
      chainId,
      riskScore: adjustedResult.riskScore,
      riskLevel: adjustedResult.riskLevel,
      decision: adjustedResult.decision,
      baseDecision: result.decision,
      riskType: result.riskType,
      factors: mergedFactors,
      isWhitelisted: false,
      cacheHit: false,
      fallback: false,
      behavior: behaviorProfile,
      behaviorEscalated: adjustedResult.behaviorEscalated,
      behaviorReason: adjustedResult.behaviorReason
    };
    
    res.json(response);
  } catch (error) {
    logger.error('Risk check failed', {
      error,
      body: req.body,
      checkId: `chk_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_error`
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process risk check'
    });
  }
});

export default router;
