import { RiskDataLoader, RiskType } from '../data/risk-data-loader';
import { logger } from '../api/middleware/logger';
import { ValidationError, validateAddress } from '../api/middleware/validator';

export interface RiskScoreInput {
  address: string;
  chainId: number;
  amount?: string;
  senderAddress?: string;
  hasMixerInteraction?: boolean;
  isHighRiskSender?: boolean;
}

export interface RiskScoreResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK';
  riskType?: RiskType;
  factors: {
    baseRisk: number;
    behaviorAdjustment: number;
    contextAdjustment: number;
    details: string[];
  };
  isSanctioned: boolean;
}

export class RiskScorer {
  private riskDataLoader: RiskDataLoader;
  
  private baseRiskScores: Record<RiskType, number> = {
    SANCTION: 85,
    HACKER: 75,
    MIXER: 70,
    SCAM: 55
  };
  
  private behaviorFactors = {
    MIXER_INTERACTION: 35,
    HIGH_RISK_SENDER: 25
  };
  
  private contextFactors = {
    LARGE_AMOUNT: 10
  };
  
  private thresholds = {
    HIGH: parseInt(process.env.RISK_THRESHOLD_HIGH || '70'),
    MEDIUM: parseInt(process.env.RISK_THRESHOLD_MEDIUM || '31'),
    MAX_SCORE: parseInt(process.env.RISK_SCORE_MAX || '100')
  };
  
  constructor() {
    this.riskDataLoader = RiskDataLoader.getInstance();
  }
  
  public calculateRiskScore(input: RiskScoreInput): RiskScoreResult {
    // 验证 address 存在且格式正确 (EVM address)
    if (!input.address || typeof input.address !== 'string') {
      throw new ValidationError([{ field: 'address', message: 'Invalid address: must be a non-empty string' }]);
    }
    if (!validateAddress(input.address)) {
      throw new ValidationError([{ field: 'address', message: 'Invalid EVM address format' }]);
    }

    const { address, chainId, amount, hasMixerInteraction, isHighRiskSender } = input;
    
    let baseRisk = 0;
    let riskType: RiskType | undefined;
    const details: string[] = [];
    let isSanctioned = false;
    
    const riskData = this.riskDataLoader.lookup(address);
    
    if (riskData) {
      riskType = riskData.risk_type;
      baseRisk = this.baseRiskScores[riskType];
      details.push(`Base risk: ${riskType} (+${baseRisk})`);
      
      if (riskType === 'SANCTION') {
        isSanctioned = true;
        details.push('Address is OFAC sanctioned');
      }
    } else {
      details.push('No direct risk data found');
    }
    
    let behaviorAdjustment = 0;
    
    if (hasMixerInteraction) {
      behaviorAdjustment += this.behaviorFactors.MIXER_INTERACTION;
      details.push(`Mixer interaction: +${this.behaviorFactors.MIXER_INTERACTION}`);
    }
    
    if (isHighRiskSender) {
      behaviorAdjustment += this.behaviorFactors.HIGH_RISK_SENDER;
      details.push(`High-risk sender: +${this.behaviorFactors.HIGH_RISK_SENDER}`);
    }
    
    let contextAdjustment = 0;
    
    if (amount && this.isLargeAmount(amount)) {
      contextAdjustment += this.contextFactors.LARGE_AMOUNT;
      details.push(`Large amount: +${this.contextFactors.LARGE_AMOUNT}`);
    }
    
    let totalScore = baseRisk + behaviorAdjustment + contextAdjustment;
    
    totalScore = Math.min(totalScore, this.thresholds.MAX_SCORE);
    
    const riskLevel = this.determineRiskLevel(totalScore, isSanctioned);
    const decision = this.determineDecision(riskLevel, isSanctioned);
    
    logger.debug('Risk score calculated', {
      address,
      chainId,
      baseRisk,
      behaviorAdjustment,
      contextAdjustment,
      totalScore,
      riskLevel,
      decision,
      isSanctioned
    });
    
    return {
      riskScore: totalScore,
      riskLevel,
      decision,
      riskType,
      factors: {
        baseRisk,
        behaviorAdjustment,
        contextAdjustment,
        details
      },
      isSanctioned
    };
  }
  
  private isLargeAmount(amount: string): boolean {
    try {
      const amountNum = parseFloat(amount);
      return amountNum > 1000000;
    } catch {
      return false;
    }
  }
  
  private determineRiskLevel(score: number, isSanctioned: boolean): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (isSanctioned) {
      return 'HIGH';
    }
    
    if (score >= this.thresholds.HIGH) {
      return 'HIGH';
    }
    
    if (score >= this.thresholds.MEDIUM) {
      return 'MEDIUM';
    }
    
    return 'LOW';
  }
  
  private determineDecision(riskLevel: 'LOW' | 'MEDIUM' | 'HIGH', isSanctioned: boolean): 'ALLOW' | 'REVIEW' | 'BLOCK' {
    if (isSanctioned) {
      return 'BLOCK';
    }
    
    switch (riskLevel) {
      case 'HIGH':
        return 'BLOCK';
      case 'MEDIUM':
        return 'REVIEW';
      case 'LOW':
        return 'ALLOW';
      default:
        return 'ALLOW';
    }
  }
  
  public getRiskThresholds() {
    return this.thresholds;
  }
  
  public getBaseRiskScores() {
    return this.baseRiskScores;
  }
}