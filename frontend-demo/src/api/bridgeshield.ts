import {
  AMLCheckResult,
  ComposerQuoteRequest,
  ComposerQuoteResponse,
  EarnPortfolioResponse,
  EarnVaultDetailResponse,
  EarnVaultListResponse,
  Stats,
  TransferHistoryResponse
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY || '';
const TIMEOUT = 5000;

const getAmlAuthHeaders = (): Record<string, string> => (API_KEY ? { 'X-API-Key': API_KEY } : {});
// Helper to create abort signal with timeout
const createTimeoutSignal = (timeoutMs: number) => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
};

export const buildQueryString = (params: Record<string, string | number | boolean | undefined>): string => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query.set(key, String(value));
  }

  return query.toString();
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const readErrorMessage = (payload: unknown, fallback: string): string => {
  if (isRecord(payload) && typeof payload.message === 'string') {
    return payload.message;
  }

  if (isRecord(payload) && typeof payload.error === 'string') {
    return payload.error;
  }

  return fallback;
};

export function transformCheckResult(backendResponse: any): AMLCheckResult {
  let riskFactors: string[] = [];
  if (backendResponse.isWhitelisted) {
    riskFactors = ['Whitelisted address'];
  } else if (backendResponse.factors?.details && Array.isArray(backendResponse.factors.details)) {
    riskFactors = backendResponse.factors.details;
  } else if (backendResponse.riskType) {
    riskFactors = [`Risk type: ${backendResponse.riskType}`];
  } else {
    riskFactors = ['No risk factors'];
  }

  function getRecommendation(decision: string, riskType?: string): string {
    if (decision === 'BLOCK') {
      return `Block this transaction. ${riskType ? `Risk type: ${riskType}.` : ''} Do not proceed.`;
    }
    if (decision === 'REVIEW') {
      if (backendResponse.behaviorEscalated && backendResponse.behavior?.recommendation) {
        return backendResponse.behavior.recommendation;
      }
      return 'Review this transaction manually before proceeding.';
    }
    return 'Transaction appears safe. Low risk detected.';
  }

  return {
    address: backendResponse.address,
    riskScore: backendResponse.riskScore || 0,
    riskLevel: backendResponse.riskLevel || 'LOW',
    action: backendResponse.decision || 'ALLOW',
    baseAction: backendResponse.baseDecision,
    riskFactors,
    recommendation: getRecommendation(backendResponse.decision, backendResponse.riskType),
    cached: backendResponse.cacheHit ?? false,
    checkId: backendResponse.checkId,
    processingTimeMs: 0,
    fallback: backendResponse.fallback ?? false,
    fallbackReason: backendResponse.fallbackReason,
    behavior: backendResponse.behavior,
    behaviorEscalated: backendResponse.behaviorEscalated ?? false,
    behaviorReason: backendResponse.behaviorReason
  };
}

export const checkAddress = async (address: string, chainId: number = 1): Promise<AMLCheckResult> => {
  try {
    const signal = createTimeoutSignal(TIMEOUT);
    const response = await fetch(`${BASE_URL}/api/v1/aml/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAmlAuthHeaders(),
      },
      body: JSON.stringify({ address, chainId }),
      signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) {
        throw new Error(readErrorMessage(payload, `Input error: ${response.status}`));
      }

      throw new Error(readErrorMessage(payload, `Server error: ${response.status}`));
    }

    return transformCheckResult(payload);
  } catch (error: unknown) {
    const maybeAbortError = isRecord(error) && error.name === 'AbortError';
    if (maybeAbortError) {
      throw new Error('Request timed out while contacting BridgeShield API.');
    }

    if (error instanceof TypeError) {
      throw new Error('Network error: unable to reach BridgeShield API.');
    }

    throw error instanceof Error ? error : new Error('Unexpected error while checking address');
  }
};

export const getWhitelist = async () => {
  const signal = createTimeoutSignal(TIMEOUT);
  const response = await fetch(`${BASE_URL}/api/v1/aml/whitelist`, {
    signal,
    headers: {
      ...getAmlAuthHeaders(),
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to fetch whitelist'));
  }

  if (!isRecord(payload) || typeof payload.total !== 'number' || !Array.isArray(payload.categories)) {
    throw new Error('Invalid whitelist response from backend');
  }

  return { total: payload.total, categories: payload.categories };
};

export const submitAppeal = async (address: string, reason: string, contact: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const signal = createTimeoutSignal(TIMEOUT);
    const response = await fetch(`${BASE_URL}/api/v1/aml/appeal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAmlAuthHeaders(),
      },
      body: JSON.stringify({ address, chainId: 1, reason, contact }),
      signal,
    });

    if (response.status >= 400 && response.status < 500) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.message || 'Invalid input' };
    }

    if (!response.ok) {
      return { success: false, error: 'Server error, please try again later' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Network error, submission failed' };
  }
};

export const getHealth = async () => {
  try {
    const signal = createTimeoutSignal(TIMEOUT);
    const response = await fetch(`${BASE_URL}/api/v1/health`, { signal });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const getStats = async (): Promise<Stats> => {
  const signal = createTimeoutSignal(TIMEOUT);
  const response = await fetch(`${BASE_URL}/api/v1/health`, { signal });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to fetch health status'));
  }

  if (!isRecord(payload)) {
    throw new Error('Invalid health response from backend');
  }

  const services = isRecord(payload.services) ? payload.services : {};
  const cacheService = isRecord(services.cache) ? services.cache : {};
  const cacheStats = isRecord(cacheService.stats) ? cacheService.stats : {};
  const cacheHits = typeof cacheStats.hits === 'number' ? cacheStats.hits : 0;
  const cacheMisses = typeof cacheStats.misses === 'number' ? cacheStats.misses : 0;
  const statusRaw = typeof payload.status === 'string' ? payload.status : 'unhealthy';
  const isOnline = statusRaw === 'healthy' || statusRaw === 'degraded';

  return {
    totalChecks: cacheHits + cacheMisses,
    totalBlocks: 0,
    averageResponseTimeMs: 0,
    status: isOnline ? 'online' : 'offline'
  };
};

export const getEarnVaults = async (params?: { chainId?: number; cursor?: string }): Promise<EarnVaultListResponse> => {
  const signal = createTimeoutSignal(TIMEOUT);
  const queryString = buildQueryString({
    chainId: params?.chainId,
    cursor: params?.cursor
  });

  const response = await fetch(`${BASE_URL}/api/v1/earn/vaults${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
    signal
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { message?: string }).message || 'Failed to fetch vault list';
    throw new Error(message);
  }

  const normalized = payload as Partial<EarnVaultListResponse>;
  if (Array.isArray(normalized.data)) {
    return normalized as EarnVaultListResponse;
  }

  throw new Error('Invalid vault list response from backend');
};

export const getEarnVaultDetail = async (network: string, address: string): Promise<EarnVaultDetailResponse> => {
  const signal = createTimeoutSignal(TIMEOUT);
  const response = await fetch(`${BASE_URL}/api/v1/earn/vault/${encodeURIComponent(network)}/${encodeURIComponent(address)}`, {
    method: 'GET',
    signal
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { message?: string }).message || 'Failed to fetch vault detail';
    throw new Error(message);
  }

  return payload as EarnVaultDetailResponse;
};

export const getEarnPortfolio = async (wallet: string): Promise<EarnPortfolioResponse> => {
  const signal = createTimeoutSignal(TIMEOUT);
  const response = await fetch(`${BASE_URL}/api/v1/earn/portfolio/${encodeURIComponent(wallet)}`, {
    method: 'GET',
    signal
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as { message?: string }).message || 'Failed to fetch portfolio';
    throw new Error(message);
  }

  const normalized = payload as Partial<EarnPortfolioResponse> & { data?: Array<Record<string, unknown>> };
  if (Array.isArray(normalized.positions)) {
    return normalized as EarnPortfolioResponse;
  }

  if (Array.isArray(normalized.data)) {
    return {
      ...normalized,
      positions: normalized.data
    } as EarnPortfolioResponse;
  }

  if (isRecord(payload) && Array.isArray(payload.positions)) {
    return payload as EarnPortfolioResponse;
  }

  throw new Error('Invalid portfolio response from backend');
};

export const buildCompliantComposerQuote = async (request: ComposerQuoteRequest): Promise<ComposerQuoteResponse> => {
  const signal = createTimeoutSignal(TIMEOUT);
  const queryString = buildQueryString({
    fromChain: request.fromChain,
    toChain: request.toChain,
    fromToken: request.fromToken,
    toToken: request.toToken,
    fromAddress: request.fromAddress,
    toAddress: request.toAddress,
    fromAmount: request.fromAmount,
    reviewConfirmed: request.reviewConfirmed
  });

  const response = await fetch(`${BASE_URL}/api/v1/composer/quote?${queryString}`, {
    method: 'GET',
    signal
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 403 && response.status !== 409) {
    const message = (payload as { message?: string; error?: string }).message ||
      (payload as { message?: string; error?: string }).error ||
      'Failed to build Composer quote';
    throw new Error(message);
  }

  if (!payload || typeof payload !== 'object' || !('aml' in payload)) {
    throw new Error('Invalid response from Composer gate API');
  }

  return payload as ComposerQuoteResponse;
};

export interface TransferHistoryParams {
  wallet: string;
  status?: 'ALL' | 'PENDING' | 'DONE' | 'FAILED';
  fromTime?: string;
  toTime?: string;
  limit?: number;
  cursor?: string;
}

export const getTransferHistory = async (params: TransferHistoryParams): Promise<TransferHistoryResponse> => {
  const signal = createTimeoutSignal(TIMEOUT);
  const queryString = buildQueryString({
    wallet: params.wallet,
    status: params.status,
    fromTime: params.fromTime,
    toTime: params.toTime,
    limit: params.limit,
    cursor: params.cursor
  });
  
  const response = await fetch(`${BASE_URL}/api/v1/analytics/transfers${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
    signal
  });

  const payload = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const message = (payload as { message?: string }).message || `Analytics API error: ${response.status}`;
    throw new Error(message);
  }

  return payload as TransferHistoryResponse;
};
