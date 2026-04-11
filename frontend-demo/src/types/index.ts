export interface AMLCheckResult {
  address: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  action: 'ALLOW' | 'REVIEW' | 'BLOCK';
  baseAction?: 'ALLOW' | 'REVIEW' | 'BLOCK';
  riskFactors: string[];
  recommendation?: string;
  cached: boolean;
  checkId?: string;
  checkedAt?: string;
  processingTimeMs: number;
  fallback?: boolean;
  fallbackReason?: string;
  behavior?: BehaviorProfile;
  behaviorEscalated?: boolean;
  behaviorReason?: string;
}

export interface Stats {
  totalChecks: number;
  totalBlocks: number;
  averageResponseTimeMs: number;
  status: 'online' | 'offline';
}

export interface EarnToken {
  address: string;
  symbol: string;
  decimals: number;
}

export interface EarnProtocol {
  name: string;
  slug?: string;
}

export interface EarnVault {
  address: string;
  name: string;
  network: string;
  chainId: number;
  isTransactional?: boolean;
  tags?: string[];
  protocol?: EarnProtocol;
  underlyingTokens?: EarnToken[];
  analytics?: {
    apy?: {
      total?: number | null;
      base?: number | null;
      reward?: number | null;
    };
    tvl?: {
      usd?: string;
    };
  };
}

export interface BridgeShieldProxyMeta {
  proxied: boolean;
  source: string;
  endpoint: string;
  requestedUrl: string;
}

export interface EarnVaultListResponse {
  data: EarnVault[];
  nextCursor?: string | null;
  total?: number;
  _bridgeShield?: BridgeShieldProxyMeta;
}

export interface EarnVaultDetailResponse {
  data?: EarnVault;
  _bridgeShield?: BridgeShieldProxyMeta;
  [key: string]: unknown;
}

export interface EarnPortfolioPosition {
  chainId?: number;
  protocolName?: string;
  balanceUsd?: string;
  balanceNative?: string;
  name?: string;
  network?: string;
  vault?: {
    name?: string;
    network?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface EarnPortfolioResponse {
  positions: EarnPortfolioPosition[];
  total?: number;
  _bridgeShield?: BridgeShieldProxyMeta;
  [key: string]: unknown;
}

export interface ComposerQuoteRequest {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAddress: string;
  toAddress: string;
  fromAmount: string;
  reviewConfirmed?: boolean;
}

export interface ComposerAmlResult {
  checkedAddress: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK';
  baseDecision?: 'ALLOW' | 'REVIEW' | 'BLOCK';
  riskType?: string;
  factors: string[];
  isWhitelisted: boolean;
  behavior: BehaviorProfile;
  behaviorEscalated: boolean;
  behaviorReason?: string;
}

export interface ComposerQuoteResponse {
  blocked?: boolean;
  requiresReviewConfirmation?: boolean;
  message?: string;
  aml: ComposerAmlResult;
  quote?: Record<string, unknown>;
  source?: {
    method: string;
    composerApi: string;
    quotePath: string;
  };
}

export interface BehaviorProfile {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  signals: string[];
  recommendation: string;
  asOf: string;
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
}
