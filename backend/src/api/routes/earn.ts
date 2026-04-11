import { Router, Request, Response } from 'express';
import { earnPortfolioValidator, earnVaultDetailValidator } from '../middleware/validator';
import { logger } from '../middleware/logger';

const router = Router();

const EARN_DATA_API_BASE_URL = process.env.EARN_DATA_API_BASE_URL || 'https://earn.li.fi';
const CHAIN_ID_BY_NETWORK: Record<string, string> = {
  ethereum: '1',
  'op mainnet': '10',
  bnb: '56',
  'bnb chain': '56',
  gnosis: '100',
  'gnosis chain': '100',
  polygon: '137',
  'polygon pos': '137',
  fantom: '250',
  avalanche: '43114',
  arbitrum: '42161',
  celo: '42220',
  base: '8453',
  linea: '59144',
  scroll: '534352',
  soneium: '1868',
  sonic: '146',
  unichain: '130',
  world: '480',
  'world chain': '480',
  mantle: '5000',
  megaeth: '6342',
  monad: '10143',
  berachain: '80094',
  hyperevm: '999',
  katana: '747474',
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

const resolveChainIdPathParam = (networkOrChainId: string): string | null => {
  const trimmed = networkOrChainId.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.toLowerCase();
  return CHAIN_ID_BY_NETWORK[normalized] || null;
};

const withProxyMeta = (payload: unknown, endpoint: string, requestedUrl: string): Record<string, unknown> => {
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    return {
      ...(payload as Record<string, unknown>),
      _bridgeShield: {
        proxied: true,
        source: 'earn.li.fi',
        endpoint,
        requestedUrl
      }
    };
  }

  return {
    data: payload,
    _bridgeShield: {
      proxied: true,
      source: 'earn.li.fi',
      endpoint,
      requestedUrl
    }
  };
};

router.get('/vaults', async (req: Request, res: Response) => {
  try {
    const queryString = buildQueryString(req.query);
    const endpointPath = '/v1/earn/vaults';
    const upstreamUrl = `${EARN_DATA_API_BASE_URL}${endpointPath}${queryString ? `?${queryString}` : ''}`;

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { accept: 'application/json' }
    });

    const upstreamBody = await parseUpstreamBody(upstreamResponse);

    if (!upstreamResponse.ok) {
      logger.warn('Earn vaults proxy request failed', {
        status: upstreamResponse.status,
        endpoint: endpointPath
      });

      res.status(upstreamResponse.status).json({
        error: 'Upstream API error',
        message: 'Failed to fetch vault list from Earn Data API',
        endpoint: endpointPath,
        upstreamStatus: upstreamResponse.status,
        upstreamBody
      });
      return;
    }

    res.json(withProxyMeta(upstreamBody, endpointPath, upstreamUrl));
  } catch (error) {
    logger.error('Earn vaults proxy request crashed', { error });
    res.status(502).json({
      error: 'Bad gateway',
      message: 'Failed to reach Earn Data API'
    });
  }
});

router.get('/vault/:network/:address', earnVaultDetailValidator, async (req: Request, res: Response) => {
  try {
    const { network, address } = req.params;
    const resolvedChainId = resolveChainIdPathParam(network);

    if (!resolvedChainId) {
      res.status(400).json({
        error: 'Validation failed',
        message: 'network must be a numeric chainId or supported network name'
      });
      return;
    }

    const endpointPath = `/v1/earn/vaults/${encodeURIComponent(resolvedChainId)}/${encodeURIComponent(address)}`;
    const upstreamUrl = `${EARN_DATA_API_BASE_URL}${endpointPath}`;

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { accept: 'application/json' }
    });

    const upstreamBody = await parseUpstreamBody(upstreamResponse);

    if (!upstreamResponse.ok) {
      logger.warn('Earn vault detail proxy request failed', {
        status: upstreamResponse.status,
        endpoint: endpointPath
      });

      res.status(upstreamResponse.status).json({
        error: 'Upstream API error',
        message: 'Failed to fetch vault detail from Earn Data API',
        endpoint: endpointPath,
        upstreamStatus: upstreamResponse.status,
        upstreamBody
      });
      return;
    }

    res.json(withProxyMeta(upstreamBody, endpointPath, upstreamUrl));
  } catch (error) {
    logger.error('Earn vault detail proxy request crashed', {
      error,
      params: req.params
    });

    res.status(502).json({
      error: 'Bad gateway',
      message: 'Failed to reach Earn Data API'
    });
  }
});

router.get('/portfolio/:wallet', earnPortfolioValidator, async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const endpointPath = `/v1/earn/portfolio/${encodeURIComponent(wallet)}/positions`;
    const upstreamUrl = `${EARN_DATA_API_BASE_URL}${endpointPath}`;

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { accept: 'application/json' }
    });

    const upstreamBody = await parseUpstreamBody(upstreamResponse);

    if (!upstreamResponse.ok) {
      logger.warn('Earn portfolio proxy request failed', {
        status: upstreamResponse.status,
        endpoint: endpointPath
      });

      res.status(upstreamResponse.status).json({
        error: 'Upstream API error',
        message: 'Failed to fetch portfolio positions from Earn Data API',
        endpoint: endpointPath,
        upstreamStatus: upstreamResponse.status,
        upstreamBody
      });
      return;
    }

    res.json(withProxyMeta(upstreamBody, endpointPath, upstreamUrl));
  } catch (error) {
    logger.error('Earn portfolio proxy request crashed', {
      error,
      params: req.params
    });

    res.status(502).json({
      error: 'Bad gateway',
      message: 'Failed to reach Earn Data API'
    });
  }
});

export default router;
