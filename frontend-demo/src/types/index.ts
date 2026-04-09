export interface AMLCheckResult {
  address: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  action: 'ALLOW' | 'REVIEW' | 'BLOCK';
  riskFactors: string[];
  recommendation?: string;
  cached: boolean;
  checkId?: string;
  checkedAt?: string;
  processingTimeMs: number;
  fallback?: boolean;
  fallbackReason?: string;
}

export interface Stats {
  totalChecks: number;
  totalBlocks: number;
  averageResponseTimeMs: number;
  status: 'online' | 'offline';
}
