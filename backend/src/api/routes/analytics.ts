import { Router, Request, Response } from 'express';
import { AnalyticsService, TransferFilters } from '../../services/analytics-service';
import { checkRateLimiter } from '../middleware/rate-limiter';
import { analyticsTransfersValidator } from '../middleware/validator';
import { logger } from '../middleware/logger';

const router = Router();
const analyticsService = new AnalyticsService();

const getSingleQueryValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }

  return '';
};

const buildQueryString = (query: Request['query']): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      params.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          params.append(key, item);
        }
      }
    }
  }

  return params.toString();
};

const parseUpstreamBody = async (upstreamResponse: globalThis.Response): Promise<unknown> => {
  const contentType = upstreamResponse.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return upstreamResponse.json();
  }

  const textBody = await upstreamResponse.text();
  return { raw: textBody };
};

const withProxyMeta = (payload: unknown, endpoint: string, requestedUrl: string, fallbackUsed?: boolean): Record<string, unknown> => {
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    return {
      ...(payload as Record<string, unknown>),
      _bridgeShield: {
        proxied: true,
        source: 'li.quest',
        endpoint,
        requestedUrl,
        fallbackUsed: fallbackUsed || false
      }
    };
  }

  return {
    data: payload,
    _bridgeShield: {
      proxied: true,
      source: 'li.quest',
      endpoint,
      requestedUrl,
      fallbackUsed: fallbackUsed || false
    }
  };
};

router.get('/transfers', checkRateLimiter, analyticsTransfersValidator, async (req: Request, res: Response) => {
  try {
    const wallet = getSingleQueryValue(req.query.wallet);
    const status = getSingleQueryValue(req.query.status);
    const fromChainStr = getSingleQueryValue(req.query.fromChain);
    const toChainStr = getSingleQueryValue(req.query.toChain);
    const fromTime = getSingleQueryValue(req.query.fromTime);
    const toTime = getSingleQueryValue(req.query.toTime);
    const cursor = getSingleQueryValue(req.query.cursor);
    const limitStr = getSingleQueryValue(req.query.limit);

    const filters: TransferFilters = {};

    if (status) filters.status = status;
    if (fromChainStr) filters.fromChain = parseInt(fromChainStr, 10);
    if (toChainStr) filters.toChain = parseInt(toChainStr, 10);
    if (fromTime) filters.fromTimestamp = fromTime;
    if (toTime) filters.toTimestamp = toTime;
    if (cursor) filters.cursor = cursor;
    if (limitStr) {
      const limit = parseInt(limitStr, 10);
      if (limit > 0 && limit <= 100) {
        filters.limit = limit;
      }
    }

    const result = await analyticsService.fetchTransfers(wallet, filters);

    const rateLimitInfo = analyticsService.getRateLimitInfo();
    if (rateLimitInfo) {
      res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit.toString());
      res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
      res.setHeader('X-RateLimit-Reset', rateLimitInfo.reset.toString());
    }

    const queryString = buildQueryString(req.query);
    const endpointPath = '/v2/analytics/transfers';
    const requestedUrl = `https://li.quest${endpointPath}${queryString ? `?${queryString}` : ''}`;

    res.json(withProxyMeta(result, endpointPath, requestedUrl, result.fallbackUsed));
  } catch (error) {
    logger.error('Analytics transfers request failed', { error, query: req.query });

    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'LI.FI Analytics API rate limit exceeded. Please try again later.',
          upstreamError: error.message
        });
        return;
      } else if (error.message.includes('validation error')) {
        res.status(400).json({
          error: 'Bad request',
          message: 'Invalid request parameters',
          upstreamError: error.message
        });
        return;
      } else if (error.message.includes('server error')) {
        res.status(502).json({
          error: 'Bad gateway',
          message: 'LI.FI Analytics API server error',
          upstreamError: error.message
        });
        return;
      }
    }

    res.status(502).json({
      error: 'Bad gateway',
      message: 'Failed to reach analytics service'
    });
  }
});

export default router;