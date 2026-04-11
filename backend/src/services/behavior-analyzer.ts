import { PrismaService } from '../db/prisma-client';
import { logger } from '../api/middleware/logger';

export interface BehaviorAnalysisInput {
  address: string;
  chainId: number;
  amount?: string;
}

export interface BehaviorHistorySample {
  createdAt: Date;
  chainId: number;
  decision: string;
  amount?: number;
}

export interface BehaviorProfile {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  signals: string[];
  metrics: {
    checks24h: number;
    checks7d: number;
    uniqueChains7d: number;
    seenOnCurrentChainBefore: boolean;
    currentAmount?: number;
    avgAmount7d?: number;
    maxAmount7d?: number;
    amountSpikeRatio?: number;
    recentRiskDecisionRatio: number;
  };
  adjustments: {
    velocity: number;
    chainNovelty: number;
    amount: number;
    decisionDrift: number;
  };
  recommendation: string;
  asOf: string;
}

export interface DecisionAdjustmentInput {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK';
}

export interface DecisionAdjustmentResult extends DecisionAdjustmentInput {
  behaviorEscalated: boolean;
  behaviorReason?: string;
}

export class BehaviorAnalyzerService {
  private prismaService: PrismaService;

  private behaviorThresholdMedium: number;
  private behaviorThresholdHigh: number;

  private maxChecks24h: number;
  private maxChecks7d: number;
  private chainNoveltyMinHistory: number;
  private spikeRatioMedium: number;
  private spikeRatioHigh: number;
  private newUserHighAmount: number;
  private decisionDriftThreshold: number;

  constructor(prismaService: PrismaService = PrismaService.getInstance()) {
    this.prismaService = prismaService;

    this.behaviorThresholdMedium = parseInt(process.env.BEHAVIOR_THRESHOLD_MEDIUM || '30', 10);
    this.behaviorThresholdHigh = parseInt(process.env.BEHAVIOR_THRESHOLD_HIGH || '60', 10);

    this.maxChecks24h = parseInt(process.env.BEHAVIOR_MAX_CHECKS_24H || '20', 10);
    this.maxChecks7d = parseInt(process.env.BEHAVIOR_MAX_CHECKS_7D || '80', 10);
    this.chainNoveltyMinHistory = parseInt(process.env.BEHAVIOR_CHAIN_NOVELTY_MIN_HISTORY || '5', 10);
    this.spikeRatioMedium = parseFloat(process.env.BEHAVIOR_SPIKE_RATIO_MEDIUM || '8');
    this.spikeRatioHigh = parseFloat(process.env.BEHAVIOR_SPIKE_RATIO_HIGH || '25');
    this.newUserHighAmount = parseFloat(process.env.BEHAVIOR_NEW_USER_HIGH_AMOUNT || '100000');
    this.decisionDriftThreshold = parseFloat(process.env.BEHAVIOR_DECISION_DRIFT_THRESHOLD || '0.4');
  }

  public async analyzeAddressBehavior(input: BehaviorAnalysisInput): Promise<BehaviorProfile> {
    const normalizedAddress = input.address.toLowerCase();
    const now = new Date();
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const logs = await this.prismaService.getClient().checkLog.findMany({
      where: {
        address: normalizedAddress,
        createdAt: {
          gte: since7d
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 200,
      select: {
        createdAt: true,
        chainId: true,
        decision: true,
        requestData: true
      }
    });

    const history = logs.map((log) => ({
      createdAt: log.createdAt,
      chainId: log.chainId,
      decision: log.decision,
      amount: this.parseAmountFromRequestData(log.requestData)
    }));

    return this.calculateProfile(input, history, now);
  }

  public calculateProfile(
    input: BehaviorAnalysisInput,
    history: BehaviorHistorySample[],
    now: Date = new Date()
  ): BehaviorProfile {
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const checks24h = history.filter((item) => item.createdAt >= since24h).length;
    const checks7d = history.length;
    const uniqueChains7d = new Set(history.map((item) => item.chainId)).size;
    const seenOnCurrentChainBefore = history.some((item) => item.chainId === input.chainId);

    const currentAmount = this.parseAmount(input.amount);
    const historicalAmounts = history
      .map((item) => item.amount)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    const avgAmount7d = historicalAmounts.length > 0
      ? historicalAmounts.reduce((sum, value) => sum + value, 0) / historicalAmounts.length
      : undefined;
    const maxAmount7d = historicalAmounts.length > 0 ? Math.max(...historicalAmounts) : undefined;
    const amountSpikeRatio = currentAmount && avgAmount7d && avgAmount7d > 0
      ? currentAmount / avgAmount7d
      : undefined;

    const recentWindow = history.slice(0, 20);
    const riskyDecisions = recentWindow.filter((item) => item.decision === 'REVIEW' || item.decision === 'BLOCK').length;
    const recentRiskDecisionRatio = recentWindow.length > 0 ? riskyDecisions / recentWindow.length : 0;

    const signals: string[] = [];
    const adjustments = {
      velocity: 0,
      chainNovelty: 0,
      amount: 0,
      decisionDrift: 0
    };

    if (checks24h >= this.maxChecks24h) {
      adjustments.velocity += 22;
      signals.push(`High activity velocity: ${checks24h} checks in 24h`);
    } else if (checks24h >= Math.ceil(this.maxChecks24h * 0.7)) {
      adjustments.velocity += 12;
      signals.push(`Elevated activity velocity: ${checks24h} checks in 24h`);
    }

    if (checks7d >= this.maxChecks7d) {
      adjustments.velocity += 10;
      signals.push(`Sustained high activity: ${checks7d} checks in 7d`);
    }

    if (!seenOnCurrentChainBefore && checks7d >= this.chainNoveltyMinHistory) {
      adjustments.chainNovelty += 15;
      signals.push(`New chain behavior: first activity on chain ${input.chainId}`);
    }

    if (uniqueChains7d >= 5) {
      adjustments.chainNovelty += 8;
      signals.push(`High chain diversity: ${uniqueChains7d} chains in 7d`);
    }

    if (currentAmount && avgAmount7d && amountSpikeRatio) {
      if (amountSpikeRatio >= this.spikeRatioHigh) {
        adjustments.amount += 28;
        signals.push(`Severe amount spike: ${amountSpikeRatio.toFixed(2)}x baseline`);
      } else if (amountSpikeRatio >= this.spikeRatioMedium) {
        adjustments.amount += 14;
        signals.push(`Amount spike: ${amountSpikeRatio.toFixed(2)}x baseline`);
      }
    }

    if (currentAmount && checks7d <= 1 && currentAmount >= this.newUserHighAmount) {
      adjustments.amount += 18;
      signals.push('High-value transaction with limited behavior history');
    }

    if (recentWindow.length >= 5 && recentRiskDecisionRatio >= this.decisionDriftThreshold) {
      adjustments.decisionDrift += 20;
      signals.push(`Recent risk drift: ${(recentRiskDecisionRatio * 100).toFixed(0)}% non-ALLOW decisions`);
    }

    const rawScore = adjustments.velocity + adjustments.chainNovelty + adjustments.amount + adjustments.decisionDrift;
    const score = Math.min(rawScore, 100);

    const confidence: 'LOW' | 'MEDIUM' | 'HIGH' =
      checks7d >= 20 ? 'HIGH' : checks7d >= 6 ? 'MEDIUM' : 'LOW';

    if (confidence === 'LOW' && signals.length > 0) {
      signals.push('Low confidence: limited historical data');
    }

    const level = this.resolveBehaviorLevel(score);
    const recommendation = this.buildRecommendation(level, signals.length > 0);

    return {
      score,
      level,
      confidence,
      signals,
      metrics: {
        checks24h,
        checks7d,
        uniqueChains7d,
        seenOnCurrentChainBefore,
        currentAmount: currentAmount || undefined,
        avgAmount7d,
        maxAmount7d,
        amountSpikeRatio,
        recentRiskDecisionRatio
      },
      adjustments,
      recommendation,
      asOf: now.toISOString()
    };
  }

  public applyBehaviorAdjustment(
    base: DecisionAdjustmentInput,
    profile: BehaviorProfile
  ): DecisionAdjustmentResult {
    if (base.decision === 'BLOCK') {
      return {
        ...base,
        behaviorEscalated: false
      };
    }

    if (profile.level === 'LOW') {
      return {
        ...base,
        behaviorEscalated: false
      };
    }

    if (base.decision === 'ALLOW') {
      return {
        decision: 'REVIEW',
        riskLevel: 'MEDIUM',
        riskScore: Math.max(base.riskScore, profile.level === 'HIGH' ? 55 : 40),
        behaviorEscalated: true,
        behaviorReason: `Escalated by behavior analytics (${profile.level})`
      };
    }

    return {
      ...base,
      riskScore: Math.max(base.riskScore, profile.level === 'HIGH' ? 65 : base.riskScore),
      behaviorEscalated: false
    };
  }

  private resolveBehaviorLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (score >= this.behaviorThresholdHigh) {
      return 'HIGH';
    }

    if (score >= this.behaviorThresholdMedium) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private buildRecommendation(level: 'LOW' | 'MEDIUM' | 'HIGH', hasSignals: boolean): string {
    if (!hasSignals || level === 'LOW') {
      return 'Behavior profile is stable. No additional action required.';
    }

    if (level === 'MEDIUM') {
      return 'Behavior anomaly detected. Require manual review before execution.';
    }

    return 'Significant behavior anomaly detected. Escalate to strict manual review.';
  }

  private parseAmountFromRequestData(requestData: string | null): number | undefined {
    if (!requestData) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(requestData) as { amount?: string | number };
      return this.parseAmount(parsed.amount);
    } catch (error) {
      logger.debug('Failed to parse amount from requestData', { error });
      return undefined;
    }
  }

  private parseAmount(value?: string | number): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0 ? value : undefined;
    }

    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    }

    return undefined;
  }
}
