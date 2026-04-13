import crypto from 'crypto';
import type { AdminUser } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../db/prisma-client';
import { logger } from '../api/middleware/logger';

const DEFAULT_JWT_EXPIRES_IN = '12h';
const DEFAULT_JWT_EXPIRES_IN_SECONDS = 60 * 60 * 12;
const JWT_ISSUER = 'bridgeshield';
const DEV_JWT_SECRET = 'bridgeshield-dev-jwt-secret-change-me';
const PASSWORD_HASH_PREFIX = 'scrypt';
const PASSWORD_HASH_KEY_LENGTH = 64;

export const ADMIN_API_SCOPE = 'admin';
export const AML_API_SCOPE = 'aml';

export interface AdminAuthContext {
  userId: string;
  username: string;
  role: string;
  authMethod: 'jwt' | 'api_key';
}

export interface ApiKeyAuthContext {
  credentialId: string | null;
  credentialName: string;
  scopes: string[];
  source: 'demo' | 'database';
}

interface AdminJwtPayload extends jwt.JwtPayload {
  sub: string;
  username: string;
  role: string;
  type: 'admin';
}

const prismaService = PrismaService.getInstance();

let hasWarnedAboutJwtFallback = false;
let initialAdminBootstrapped = false;
let initialAdminBootstrapPromise: Promise<void> | null = null;

const normalizeUsername = (username: string): string => username.trim().toLowerCase();

const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const getJwtSecret = (): string => {
  const configuredSecret = process.env.JWT_SECRET?.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }

  if (!hasWarnedAboutJwtFallback) {
    hasWarnedAboutJwtFallback = true;
    logger.warn('JWT_SECRET is not set, using insecure development fallback secret');
  }

  return DEV_JWT_SECRET;
};

const parseScopes = (rawScopes: string | null): string[] => {
  if (!rawScopes) {
    return ['*'];
  }

  try {
    const parsed = JSON.parse(rawScopes);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((scope): scope is string => typeof scope === 'string')
        .map((scope) => scope.trim())
        .filter(Boolean);
    }
  } catch {
    // Ignore and fallback to comma-separated parsing.
  }

  return rawScopes
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
};

const hasRequiredScope = (scopes: string[], requiredScope?: string): boolean => {
  if (!requiredScope) {
    return true;
  }

  return scopes.includes('*') || scopes.includes(requiredScope);
};

export const hashApiKey = (apiKey: string): string =>
  crypto.createHash('sha256').update(apiKey).digest('hex');

export const getApiKeyPrefix = (apiKey: string): string => apiKey.slice(0, 8);

export const hashPassword = (password: string): string => {
  if (!password) {
    throw new Error('Password must not be empty');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, PASSWORD_HASH_KEY_LENGTH).toString('hex');
  return `${PASSWORD_HASH_PREFIX}:${salt}:${hash}`;
};

export const verifyPassword = (password: string, passwordHash: string): boolean => {
  const [prefix, salt, expectedHash] = passwordHash.split(':');

  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !expectedHash) {
    logger.warn('Unsupported password hash format for admin user');
    return false;
  }

  const actualHash = crypto.scryptSync(password, salt, PASSWORD_HASH_KEY_LENGTH).toString('hex');
  return safeCompare(actualHash, expectedHash);
};

export const createAdminAccessToken = (admin: Pick<AdminUser, 'id' | 'username' | 'role'>): {
  accessToken: string;
  expiresIn: number;
} => {
  const payload: AdminJwtPayload = {
    sub: admin.id,
    username: admin.username,
    role: admin.role,
    type: 'admin',
  };

  const accessToken = jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: DEFAULT_JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
  });

  return {
    accessToken,
    expiresIn: DEFAULT_JWT_EXPIRES_IN_SECONDS,
  };
};

export const verifyAdminAccessToken = (token: string): AdminAuthContext | null => {
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
    }) as AdminJwtPayload;

    if (
      payload.type !== 'admin' ||
      typeof payload.sub !== 'string' ||
      typeof payload.username !== 'string' ||
      typeof payload.role !== 'string'
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      authMethod: 'jwt',
    };
  } catch {
    return null;
  }
};

export const validateApiKey = async (
  apiKey: string,
  requiredScope?: string
): Promise<ApiKeyAuthContext | null> => {
  const candidate = apiKey.trim();
  if (!candidate) {
    return null;
  }

  const demoApiKey = process.env.DEMO_API_KEY?.trim();
  if (demoApiKey && safeCompare(candidate, demoApiKey)) {
    return {
      credentialId: null,
      credentialName: 'demo-api-key',
      scopes: ['*'],
      source: 'demo',
    };
  }

  const credential = await prismaService.getClient().apiCredential.findUnique({
    where: { keyHash: hashApiKey(candidate) },
  });

  if (!credential || !credential.isActive) {
    return null;
  }

  if (credential.expiresAt && credential.expiresAt <= new Date()) {
    return null;
  }

  const scopes = parseScopes(credential.scopes);
  if (!hasRequiredScope(scopes, requiredScope)) {
    return null;
  }

  await prismaService.getClient().apiCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    credentialId: credential.id,
    credentialName: credential.name,
    scopes,
    source: 'database',
  };
};

export const authenticateAdminCredentials = async (
  username: string,
  password: string
): Promise<Pick<AdminUser, 'id' | 'username' | 'role'> | null> => {
  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername || !password) {
    return null;
  }

  const admin = await prismaService.getClient().adminUser.findUnique({
    where: { username: normalizedUsername },
  });

  if (!admin || !admin.isActive) {
    return null;
  }

  if (!verifyPassword(password, admin.passwordHash)) {
    return null;
  }

  const updatedAdmin = await prismaService.getClient().adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: updatedAdmin.id,
    username: updatedAdmin.username,
    role: updatedAdmin.role,
  };
};

const bootstrapInitialAdminUser = async (): Promise<void> => {
  const username = process.env.ADMIN_INIT_USERNAME?.trim();
  const password = process.env.ADMIN_INIT_PASSWORD;

  if (!username || !password) {
    logger.warn('Initial admin bootstrap skipped: ADMIN_INIT_USERNAME or ADMIN_INIT_PASSWORD missing');
    initialAdminBootstrapped = true;
    return;
  }

  const normalizedUsername = normalizeUsername(username);
  const existingAdmin = await prismaService.getClient().adminUser.findUnique({
    where: { username: normalizedUsername },
  });

  if (existingAdmin) {
    initialAdminBootstrapped = true;
    return;
  }

  await prismaService.getClient().adminUser.create({
    data: {
      username: normalizedUsername,
      passwordHash: hashPassword(password),
      role: 'ADMIN',
      isActive: true,
    },
  });

  initialAdminBootstrapped = true;
  logger.info('Initial admin user created', { username: normalizedUsername });
};

export const ensureInitialAdminUser = async (): Promise<void> => {
  if (initialAdminBootstrapped) {
    return;
  }

  if (!initialAdminBootstrapPromise) {
    initialAdminBootstrapPromise = bootstrapInitialAdminUser()
      .catch((error) => {
        initialAdminBootstrapped = false;
        throw error;
      })
      .finally(() => {
        initialAdminBootstrapPromise = null;
      });
  }

  await initialAdminBootstrapPromise;
};
