import { Router, Request, Response } from 'express';
import { RiskDataLoader } from '../../data/risk-data-loader';
import { RiskScorer } from '../../services/risk-scorer';
import { BehaviorAnalyzerService, BehaviorProfile } from '../../services/behavior-analyzer';
import { checkRateLimiter } from '../middleware/rate-limiter';
import { composerQuoteValidator } from '../middleware/validator';
import { logger } from '../middleware/logger';

const router = Router();

const LI_FI_API_BASE_URL = process.env.LI_FI_API_BASE_URL || process.env.COMPOSER_API_BASE_URL || 'https://li.quest';
const COMPOSER_API_KEY = process.env.COMPOSER_API_KEY || '';

const riskDataLoader = RiskDataLoader.getInstance();
const riskScorer = new RiskScorer();
const behaviorAnalyzer = new BehaviorAnalyzerService();

interface AmlGateResult {
  checkedAddress: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK';
  baseDecision: 'ALLOW' | 'REVIEW' | 'BLOCK';
  riskType?: string;
  factors: string[];
  isWhitelisted: boolean;
  behavior: BehaviorProfile;
  behaviorEscalated: boolean;
  behaviorReason?: string;
}

const getSingleQueryValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }

  return '';
};

const buildComposerQueryString = (query: Request['query']): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (key === 'reviewConfirmed') {
      continue;
    }

    if (typeof value === 'string') {
      params.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          params.append(key, item);
        }
      }
    }
  }

  return params.toString();
};

const parseUpstreamBody = async (upstreamResponse: globalThis.Response): Promise<unknown> => {
  const contentType = upstreamResponse.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return upstreamResponse.json();
  }

  const textBody = await upstreamResponse.text();
  return { raw: textBody };
};

const evaluateAmlGate = async (address: string, chainId: number, amount: string): Promise<AmlGateResult> => {
  const normalizedAddress = address.toLowerCase();
  const behavior = await behaviorAnalyzer.analyzeAddressBehavior({
    address: normalizedAddress,
    chainId,
    amount
  });

  const behaviorSignals = behavior.signals.map((signal) => `Behavior: ${signal}`);

  if (riskDataLoader.isWhitelisted(normalizedAddress)) {
    const adjusted = behaviorAnalyzer.applyBehaviorAdjustment({
      riskScore: 0,
      riskLevel: 'LOW',
      decision: 'ALLOW'
    }, behavior);

    return {
      checkedAddress: normalizedAddress,
      riskScore: adjusted.riskScore,
      riskLevel: adjusted.riskLevel,
      decision: adjusted.decision,
      baseDecision: 'ALLOW',
      factors: ['Whitelisted address', ...behaviorSignals],
      isWhitelisted: true,
      behavior,
      behaviorEscalated: adjusted.behaviorEscalated,
      behaviorReason: adjusted.behaviorReason
    };
  }

  const riskData = riskDataLoader.lookup(normalizedAddress);
  const result = riskScorer.calculateRiskScore({
    address: normalizedAddress,
    chainId,
    amount,
    hasMixerInteraction: riskData?.risk_type === 'MIXER'
  });
  const adjusted = behaviorAnalyzer.applyBehaviorAdjustment({
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    decision: result.decision
  }, behavior);

  return {
    checkedAddress: normalizedAddress,
    riskScore: adjusted.riskScore,
    riskLevel: adjusted.riskLevel,
    decision: adjusted.decision,
    baseDecision: result.decision,
    riskType: result.riskType,
    factors: [...result.factors.details, ...behaviorSignals],
    isWhitelisted: false,
    behavior,
    behaviorEscalated: adjusted.behaviorEscalated,
    behaviorReason: adjusted.behaviorReason
  };
};

router.get('/quote', checkRateLimiter, composerQuoteValidator, async (req: Request, res: Response) => {
  try {
    const fromChain = parseInt(getSingleQueryValue(req.query.fromChain), 10);
    const fromAddress = getSingleQueryValue(req.query.fromAddress);
    const fromAmount = getSingleQueryValue(req.query.fromAmount);
    const reviewConfirmed = getSingleQueryValue(req.query.reviewConfirmed) === 'true';

    const aml = await evaluateAmlGate(fromAddress, fromChain, fromAmount);

    if (aml.decision === 'BLOCK') {
      res.status(403).json({
        blocked: true,
        requiresReviewConfirmation: false,
        message: 'Transaction blocked due to AML policy',
        aml
      });
      return;
    }

    if (aml.decision === 'REVIEW' && !reviewConfirmed) {
      res.status(409).json({
        blocked: false,
        requiresReviewConfirmation: true,
        message: aml.behaviorEscalated
          ? 'Behavior anomaly detected. Re-submit with reviewConfirmed=true to continue.'
          : 'Manual review required. Re-submit with reviewConfirmed=true to continue.',
        aml
      });
      return;
    }

    if (!COMPOSER_API_KEY) {
      logger.error('Composer quote blocked: missing COMPOSER_API_KEY');
      res.status(500).json({
        error: 'Configuration error',
        message: 'COMPOSER_API_KEY is not configured on backend',
        aml
      });
      return;
    }

    const queryString = buildComposerQueryString(req.query);
    const quotePath = '/v1/quote';
    const upstreamUrl = `${LI_FI_API_BASE_URL}${quotePath}${queryString ? `?${queryString}` : ''}`;

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-lifi-api-key': COMPOSER_API_KEY
      }
    });

    const upstreamBody = await parseUpstreamBody(upstreamResponse);

    if (!upstreamResponse.ok) {
      logger.warn('Composer quote upstream request failed', {
        status: upstreamResponse.status
      });

      res.status(upstreamResponse.status).json({
        error: 'Upstream API error',
        message: 'Composer quote request failed',
        aml,
        upstreamStatus: upstreamResponse.status,
        upstreamBody
      });
      return;
    }

    res.json({
      blocked: false,
      requiresReviewConfirmation: false,
      aml,
      quote: upstreamBody,
      source: {
        method: 'GET',
        lifiApi: LI_FI_API_BASE_URL,
        quotePath
      }
    });
  } catch (error) {
    logger.error('Composer quote request crashed', { error, query: req.query });
    res.status(502).json({
      error: 'Bad gateway',
      message: 'Failed to reach Composer API'
    });
  }
});

export default router;
