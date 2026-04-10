import { Appeal, WhitelistEntry, CheckLog, DashboardStats, RiskTrendDay, RiskDistributionItem } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (error) {
    console.warn('API unavailable, using mock data', error);
    return getMockData(endpoint, options.method || 'GET') as T;
  }
}

const normalizeAppeal = (appeal: any): Appeal => ({
  id: appeal.id,
  ticketId: appeal.ticketId,
  address: appeal.address,
  reason: appeal.reason,
  contact: appeal.contact,
  status: appeal.status,
  reviewNote: appeal.reviewNote || appeal.notes,
  reviewedAt: appeal.reviewedAt || undefined,
  createdAt: appeal.createdAt,
});

const normalizeWhitelistEntry = (entry: any): WhitelistEntry => ({
  id: entry.id,
  address: entry.address,
  type: entry.type,
  label: entry.label,
  chainId: entry.chainId,
  expiresAt: entry.expiresAt || undefined,
  createdAt: entry.createdAt,
});

// Mock data generators
function getMockData(endpoint: string, method: string): any {
  // Dashboard stats
  if (endpoint === '/api/v1/admin/dashboard/stats' && method === 'GET') {
    return {
      todayChecks: 1247,
      todayBlocks: 89,
      cacheHitRate: 87.2,
      avgResponseTime: 124,
      checksTrend: 12.3,
      blocksTrend: -4.2,
    } as DashboardStats;
  }

  // Risk trend data
  if (endpoint === '/api/v1/admin/dashboard/risk-trend' && method === 'GET') {
    return [
      { date: 'Apr 03', blocks: 67, checks: 987 },
      { date: 'Apr 04', blocks: 72, checks: 1012 },
      { date: 'Apr 05', blocks: 91, checks: 1103 },
      { date: 'Apr 06', blocks: 83, checks: 1089 },
      { date: 'Apr 07', blocks: 95, checks: 1210 },
      { date: 'Apr 08', blocks: 93, checks: 1194 },
      { date: 'Apr 09', blocks: 89, checks: 1247 },
    ] as RiskTrendDay[];
  }

  // Risk distribution
  if (endpoint === '/api/v1/admin/dashboard/risk-distribution' && method === 'GET') {
    return {
      levels: [
        { name: 'LOW', value: 65, color: '#22C55E' },
        { name: 'MEDIUM', value: 25, color: '#F59E0B' },
        { name: 'HIGH', value: 10, color: '#EF4444' },
      ] as RiskDistributionItem[],
      sources: [
        { name: 'SANCTION', value: 35, color: '#3B82F6' },
        { name: 'HACKER', value: 30, color: '#8B5CF6' },
        { name: 'MIXER', value: 20, color: '#EC4899' },
        { name: 'SCAM', value: 15, color: '#F97316' },
      ] as RiskDistributionItem[],
    };
  }

  // Appeals
  if (endpoint.startsWith('/api/v1/admin/appeals') && method === 'GET') {
    return [
      {
        id: '1',
        ticketId: 'APL-001',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        reason: 'I am the owner of this address, it was incorrectly flagged as hacker associated. I have never engaged in any malicious activity.',
        contact: 'user@example.com',
        status: 'PENDING',
        createdAt: '2026-04-09T10:30:00Z',
      },
      {
        id: '2',
        ticketId: 'APL-002',
        address: '0xabcdef1234567890abcdef1234567890abcdef12',
        reason: 'This is a contract address for our DeFi protocol, it was flagged incorrectly.',
        contact: 'admin@protocol.xyz',
        status: 'PENDING',
        createdAt: '2026-04-08T14:15:00Z',
      },
      {
        id: '3',
        ticketId: 'APL-003',
        address: '0x9876543210fedcba9876543210fedcba98765432',
        reason: 'I received funds from a friend, did not know they were from a mixer.',
        status: 'APPROVED',
        reviewNote: 'Legitimate user, no malicious activity found',
        reviewedAt: '2026-04-07T09:45:00Z',
        createdAt: '2026-04-06T11:20:00Z',
      },
      {
        id: '4',
        ticketId: 'APL-004',
        address: '0xfedcba0987654321fedcba0987654321fedcba09',
        reason: 'This is my personal wallet, not associated with any scams.',
        status: 'REJECTED',
        reviewNote: 'Address is directly associated with multiple scam transactions',
        reviewedAt: '2026-04-07T13:10:00Z',
        createdAt: '2026-04-05T16:30:00Z',
      },
    ] as Appeal[];
  }

  // Approve appeal
  if (endpoint.match(/\/api\/v1\/admin\/appeal\/.*\/approve/) && method === 'POST') {
    return { success: true };
  }

  // Reject appeal
  if (endpoint.match(/\/api\/v1\/admin\/appeal\/.*\/reject/) && method === 'POST') {
    return { success: true };
  }

  // Whitelist
  if (endpoint === '/api/v1/admin/whitelist' && method === 'GET') {
    return [
      {
        id: '1',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        type: 'LIFI_OFFICIAL',
        label: 'LiFi Router Contract',
        chainId: 1,
        createdAt: '2026-01-15T00:00:00Z',
      },
      {
        id: '2',
        address: '0xabcdef1234567890abcdef1234567890abcdef12',
        type: 'KNOWN_PROTOCOL',
        label: 'Uniswap V3 Router',
        chainId: 1,
        createdAt: '2026-01-20T00:00:00Z',
      },
      {
        id: '3',
        address: '0x9876543210fedcba9876543210fedcba98765432',
        type: 'BRIDGE_CONTRACT',
        label: 'Arbitrum Bridge',
        chainId: 42161,
        createdAt: '2026-02-05T00:00:00Z',
      },
      {
        id: '4',
        address: '0xfedcba0987654321fedcba0987654321fedcba09',
        type: 'APPEAL_APPROVED',
        label: 'User Appeal #3',
        createdAt: '2026-04-07T09:45:00Z',
      },
      {
        id: '5',
        address: '0x1111111254fb6c44bac0bed2854e76f90643097d',
        type: 'KNOWN_PROTOCOL',
        label: '1inch Router',
        chainId: 1,
        createdAt: '2026-03-01T00:00:00Z',
      },
    ] as WhitelistEntry[];
  }

  // Add to whitelist
  if (endpoint === '/api/v1/admin/whitelist' && method === 'POST') {
    return { success: true };
  }

  // Remove from whitelist
  if (endpoint.startsWith('/api/v1/admin/whitelist/') && method === 'DELETE') {
    return { success: true };
  }

  // Logs
  if (endpoint === '/api/v1/admin/logs' && method === 'GET') {
    const logs: CheckLog[] = [];
    const riskLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
    const riskFactors = ['SANCTION_SCREEN', 'HACKER_ASSOCIATED', 'MIXER_ACTIVITY', 'SCAM_RELATED', 'UNVERIFIED_CONTRACT'];

    for (let i = 0; i < 25; i++) {
      const riskLevel = riskLevels[Math.floor(Math.random() * riskLevels.length)];
      logs.push({
        id: `log-${i}`,
        checkId: `CHK-${1000 + i}`,
        address: `0x${Math.random().toString(16).substring(2, 42)}`,
        chainId: [1, 10, 42161, 137][Math.floor(Math.random() * 4)],
        riskScore: Math.floor(Math.random() * 100),
        riskLevel,
        action: riskLevel === 'HIGH' ? 'BLOCK' : riskLevel === 'MEDIUM' ? 'REVIEW' : 'ALLOW',
        riskFactors: [riskFactors[Math.floor(Math.random() * riskFactors.length)]],
        processingTimeMs: Math.floor(Math.random() * 300) + 50,
        cached: Math.random() > 0.3,
        fallback: Math.random() > 0.9,
        createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      });
    }
    return logs;
  }

  return {};
}

// API functions
export const adminApi = {
  getDashboardStats: () => apiFetch<DashboardStats>('/api/v1/admin/dashboard/stats'),
  getRiskTrend: () => apiFetch<RiskTrendDay[]>('/api/v1/admin/dashboard/risk-trend'),
  getRiskDistribution: () => apiFetch<{ levels: RiskDistributionItem[]; sources: RiskDistributionItem[] }>('/api/v1/admin/dashboard/risk-distribution'),
  
  getAppeals: async () => {
    const appeals = await apiFetch<any[]>('/api/v1/admin/appeals');
    return appeals.map(normalizeAppeal);
  },
  approveAppeal: (id: string) => apiFetch(`/api/v1/admin/appeal/${id}/approve`, { method: 'POST' }),
  rejectAppeal: (id: string, notes?: string) =>
    apiFetch(`/api/v1/admin/appeal/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(notes ? { notes } : {}),
    }),

  getWhitelist: async () => {
    const entries = await apiFetch<any[]>('/api/v1/admin/whitelist');
    return entries.map(normalizeWhitelistEntry);
  },
  addToWhitelist: (entry: Omit<WhitelistEntry, 'id' | 'createdAt'>) => 
    apiFetch('/api/v1/admin/whitelist', { method: 'POST', body: JSON.stringify(entry) }),
  removeFromWhitelist: (id: string) => 
    apiFetch(`/api/v1/admin/whitelist/${id}`, { method: 'DELETE' }),

  getLogs: () => apiFetch<CheckLog[]>('/api/v1/admin/logs'),
};
