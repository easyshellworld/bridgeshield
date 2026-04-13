import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger';
import {
  ADMIN_API_SCOPE,
  type AdminAuthContext,
  type ApiKeyAuthContext,
  validateApiKey,
  verifyAdminAccessToken,
} from '../../services/auth-service';

interface RequestAuth {
  admin?: AdminAuthContext;
  apiKey?: ApiKeyAuthContext;
}

declare global {
  namespace Express {
    interface Request {
      auth?: RequestAuth;
    }
  }
}

const getHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return null;
};

const getBearerToken = (req: Request): string | null => {
  const authorization = getHeaderValue(req.headers.authorization);
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token?.trim()) {
    return null;
  }

  return token.trim();
};

const getApiKeyHeader = (req: Request): string | null => {
  const headerValue = getHeaderValue(req.headers['x-api-key']);
  return headerValue?.trim() || null;
};

const setAdminAuthFromApiKey = (req: Request, apiKey: ApiKeyAuthContext): void => {
  req.auth = {
    admin: {
      userId: apiKey.credentialId || `api-key:${apiKey.credentialName}`,
      username: apiKey.credentialName,
      role: 'API_KEY',
      authMethod: 'api_key',
    },
    apiKey,
  };
};

const respondUnauthorized = (
  res: Response,
  message: string
): Response => res.status(401).json({
  error: 'Unauthorized',
  message,
});

export const requireApiKey = (requiredScope?: string) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tokenCandidate = getApiKeyHeader(req) || getBearerToken(req);

    if (!tokenCandidate) {
      respondUnauthorized(res, 'Valid API key is required');
      return;
    }

    const apiKey = await validateApiKey(tokenCandidate, requiredScope);

    if (!apiKey) {
      respondUnauthorized(res, 'Valid API key is required');
      return;
    }

    req.auth = {
      ...req.auth,
      apiKey,
    };
    next();
  } catch (error) {
    logger.error('API key authentication failed unexpectedly', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed',
    });
  }
};

export const requireAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const bearerToken = getBearerToken(req);

    if (bearerToken) {
      const adminFromJwt = verifyAdminAccessToken(bearerToken);
      if (adminFromJwt) {
        req.auth = {
          ...req.auth,
          admin: adminFromJwt,
        };
        next();
        return;
      }

      const apiKeyFromBearer = await validateApiKey(bearerToken, ADMIN_API_SCOPE);
      if (apiKeyFromBearer) {
        setAdminAuthFromApiKey(req, apiKeyFromBearer);
        next();
        return;
      }
    }

    const apiKeyHeader = getApiKeyHeader(req);
    if (apiKeyHeader) {
      const apiKey = await validateApiKey(apiKeyHeader, ADMIN_API_SCOPE);
      if (apiKey) {
        setAdminAuthFromApiKey(req, apiKey);
        next();
        return;
      }
    }

    respondUnauthorized(res, 'Admin authentication required');
  } catch (error) {
    logger.error('Admin authentication failed unexpectedly', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed',
    });
  }
};
