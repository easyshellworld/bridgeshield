export interface Appeal {
  id: string;
  ticketId: string;
  address: string;
  reason: string;
  contact?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface WhitelistEntry {
  id: string;
  address: string;
  type: 'LIFI_OFFICIAL' | 'KNOWN_PROTOCOL' | 'BRIDGE_CONTRACT' | 'APPEAL_APPROVED';
  label: string;
  chainId?: number;
  expiresAt?: string;
  createdAt: string;
}

export interface CheckLog {
  id: string;
  checkId: string;
  address: string;
  chainId: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  action: 'ALLOW' | 'REVIEW' | 'BLOCK';
  riskFactors: string[];
  processingTimeMs: number;
  cached: boolean;
  fallback: boolean;
  createdAt: string;
}

export interface DashboardStats {
  todayChecks: number;
  todayBlocks: number;
  cacheHitRate: number;
  avgResponseTime: number;
  checksTrend: number;
  blocksTrend: number;
}

export interface RiskTrendDay {
  date: string;
  blocks: number;
  checks: number;
}

export interface RiskDistributionItem {
  name: string;
  value: number;
  color: string;
}