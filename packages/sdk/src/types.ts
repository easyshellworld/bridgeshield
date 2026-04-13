// Risk levels and action types
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type Action = 'ALLOW' | 'REVIEW' | 'BLOCK';
export type AppealStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Check address params and response
export interface CheckAddressParams {
  address: string;
  chainId?: number;
  amount?: string;
  senderAddress?: string;
}

export interface BehaviorSignal {
  type: string;
  score: number;
  description: string;
}

export interface BehaviorProfile {
  address: string;
  chainId?: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  signals: string[];
  lifiSignals?: string[];
  metrics: {
    checkVelocity24h?: number;
    checkVelocity7d?: number;
    chainNovelty?: number;
    amountSpike?: number;
    decisionDrift?: number;
    lifiHistoryFallback?: boolean;
  };
  lifiScore?: number;
  lifiConfidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  lifiHistory?: unknown;
  lifiReferencedAddresses?: number;
  lifiFirstTransaction?: { amount: string; timestamp: string };
  lifiCrossChainTumbling?: boolean;
  lifiHighRiskInteraction?: boolean;
  lifiAmountSpike?: boolean;
  lifiHighChainDiversity?: boolean;
  analyzedAt: string;
}

export interface CheckAddressResponse {
  checkId: string;
  address: string;
  chainId: number;
  riskScore: number;
  riskLevel: RiskLevel;
  decision: Action;
  baseDecision?: Action;
  riskType?: string;
  factors?: {
    details?: string[];
  };
  isWhitelisted: boolean;
  cacheHit: boolean;
  cacheTier?: string;
  cachedAt?: string;
  expiresAt?: string;
  fallback?: boolean;
  fallbackReason?: string;
  behavior?: BehaviorProfile;
  behaviorEscalated?: boolean;
  behaviorReason?: string;
}

// Appeal params and response
export interface SubmitAppealParams {
  address: string;
  chainId?: number;
  reason: string;
  contact?: string;
}

export interface SubmitAppealResponse {
  ticketId: string;
  address: string;
  chainId: number;
  status: AppealStatus;
  estimatedReviewAt: string;
  message: string;
  nextSteps: string[];
}

export interface AppealStatusResponse {
  ticketId: string;
  status: AppealStatus;
  createdAt: string;
  estimatedReviewAt: string;
  address?: string;
  chainId?: number;
  reason?: string;
  contact?: string;
  reviewedAt?: string;
  reviewer?: string;
  decision?: AppealStatus;
  notes?: string;
}

// Whitelist response
export interface WhitelistCategory {
  category: string;
  count: number;
}

export interface WhitelistSummary {
  total: number;
  categories: WhitelistCategory[];
  lastSyncedAt: string;
  version: string;
}

// Health check response
export interface ServiceHealth {
  healthy: boolean;
  status: string;
  error?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: string;
  services: {
    database: ServiceHealth | string;
    riskData: ServiceHealth | string;
    cache: ServiceHealth | string;
    redis: string;
  };
}

// Client configuration
export interface BridgeShieldConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

// Error types
export class BridgeShieldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BridgeShieldError';
  }
}

export class ApiError extends BridgeShieldError {
  statusCode: number;
  response?: unknown;

  constructor(message: string, statusCode: number, response?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

export class NetworkError extends BridgeShieldError {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends BridgeShieldError {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
