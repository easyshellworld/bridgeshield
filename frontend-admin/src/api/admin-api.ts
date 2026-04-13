import type {
  Appeal,
  WhitelistEntry,
  CheckLog,
  DashboardStats,
  RiskTrendDay,
  RiskDistributionItem,
  AdminLoginResponse,
  TransferHistoryResponse,
} from '../types';
import { clearAdminSession, getAdminAccessToken } from '../auth/session';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

type ApiFetchOptions = RequestInit & {
  skipAuth?: boolean;
};

async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth = false, headers, ...requestOptions } = options;
  const accessToken = getAdminAccessToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && !skipAuth ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (response.status === 401 && !skipAuth) {
    clearAdminSession();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
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

const buildTransferQueryString = (
  wallet: string,
  params?: { status?: string; fromTime?: string; toTime?: string; limit?: number; cursor?: string }
): string => {
  const searchParams = new URLSearchParams();
  searchParams.set('wallet', wallet);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.fromTime) searchParams.set('fromTime', params.fromTime);
  if (params?.toTime) searchParams.set('toTime', params.toTime);
  if (typeof params?.limit === 'number') searchParams.set('limit', String(params.limit));
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  return searchParams.toString();
};

export const adminApi = {
  login: (username: string, password: string) =>
    apiFetch<AdminLoginResponse>('/api/v1/admin/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ username, password }),
    }),

  getDashboardStats: () => apiFetch<DashboardStats>('/api/v1/admin/dashboard/stats'),
  getRiskTrend: () => apiFetch<RiskTrendDay[]>('/api/v1/admin/dashboard/risk-trend'),
  getRiskDistribution: () =>
    apiFetch<{ levels: RiskDistributionItem[]; sources: RiskDistributionItem[] }>(
      '/api/v1/admin/dashboard/risk-distribution'
    ),

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
  removeFromWhitelist: (id: string) => apiFetch(`/api/v1/admin/whitelist/${id}`, { method: 'DELETE' }),

  getLogs: () => apiFetch<CheckLog[]>('/api/v1/admin/logs'),

  getTransferHistory: (
    wallet: string,
    params?: { status?: string; fromTime?: string; toTime?: string; limit?: number; cursor?: string }
  ) => apiFetch<TransferHistoryResponse>(`/api/v1/analytics/transfers?${buildTransferQueryString(wallet, params)}`),
};
