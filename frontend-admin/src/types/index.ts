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
  type: 'LIFI_OFFICIAL' | 'KNOWN_PROTOCOL' | 'BRIDGE_CONTRACT' | 'APPEAL_APPROVED' | 'APPEAL_TEMPORARY';
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
export interface TransferHistoryItem {
  id: string;
  fromAddress: string;
  toAddress: string;
  fromChain: number;
  toChain: number;
  amount: string;
  amountUsd?: number;
  status: string;
  timestamp: string;
  txHash?: string;
  feeAmount?: string;
  feeToken?: string;
}

export interface TransferHistoryResponse {
  transfers: TransferHistoryItem[];
  hasNext: boolean;
  hasPrevious: boolean;
  next: string | null;
  previous: string | null;
}

export interface AdminSessionUser {
  id: string;
  username: string;
  role: string;
}

export interface AdminLoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AdminSessionUser;
}
