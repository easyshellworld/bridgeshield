import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { PrismaService } from '../../src/db/prisma-client';
import { CacheService } from '../../src/services/cache-service';

let app: Express;
let uniqueCounter = 0;
const DEMO_API_KEY = process.env.DEMO_API_KEY || 'demo-test-api-key';
const ADMIN_USERNAME = process.env.ADMIN_INIT_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_INIT_PASSWORD || 'admin-password';

const createUniqueAddress = () => {
  uniqueCounter += 1;
  return `0x${(Date.now() + uniqueCounter).toString(16).padStart(40, '0')}`.slice(0, 42);
};

const withApiKey = (req: any) => req.set('x-api-key', DEMO_API_KEY);

const withAdminToken = (req: any, token: string) => req.set('Authorization', `Bearer ${token}`);

const getAdminAccessToken = async (): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/admin/auth/login')
    .send({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    });

  expect(response.status).toBe(200);
  expect(response.body.accessToken).toBeDefined();
  return response.body.accessToken;
};

beforeAll(async () => {
  const prisma = PrismaService.getInstance();
  await prisma.connect();
  const mod = await import('../../src/app');
  app = mod.app;
});

describe('GET /api/v1/health', () => {
  it('returns 200 with healthy status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('includes service statuses', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.services).toBeDefined();
    expect(res.body.services.database).toBeDefined();
    expect(res.body.services.riskData).toBeDefined();
    expect(res.body.services.cache).toBeDefined();
  });

  it('reports redis as disabled', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.services.redis).toContain('disabled');
  });
});

describe('POST /api/v1/aml/check', () => {
  it('returns BLOCK for known hacker address', async () => {
    const res = await withApiKey(request(app)
      .post('/api/v1/aml/check')
      .send({
        address: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96',
        chainId: 1,
      }));
    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('BLOCK');
    expect(res.body.riskScore).toBeGreaterThanOrEqual(70);
    expect(res.body.riskLevel).toBe('HIGH');
  });

  it('returns ALLOW for whitelisted address', async () => {
    const res = await withApiKey(request(app)
      .post('/api/v1/aml/check')
      .send({
        address: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        chainId: 1,
      }));
    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.isWhitelisted).toBe(true);
    expect(res.body.riskScore).toBe(0);
  });

  it('returns ALLOW for clean unknown address', async () => {
    const res = await withApiKey(request(app)
      .post('/api/v1/aml/check')
      .send({
        address: '0x0000000000000000000000000000000000000001',
        chainId: 1,
      }));
    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.riskScore).toBe(0);
  });

  it('returns 400 for invalid address', async () => {
    const res = await withApiKey(request(app)
      .post('/api/v1/aml/check')
      .send({ address: 'not-valid', chainId: 1 }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 400 for missing address', async () => {
    const res = await withApiKey(request(app)
      .post('/api/v1/aml/check')
      .send({ chainId: 1 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing chainId', async () => {
    const res = await withApiKey(request(app)
      .post('/api/v1/aml/check')
      .send({ address: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96' }));
    expect(res.status).toBe(400);
  });

  it('returns cached result on second call', async () => {
    const addr = '0x098B716B8Aaf21512996dC57EB0615e2383E2f96';
    await withApiKey(request(app).post('/api/v1/aml/check').send({ address: addr, chainId: 1 }));

    const res = await withApiKey(request(app)
      .post('/api/v1/aml/check')
      .send({ address: addr, chainId: 1 }));
    expect(res.status).toBe(200);
    expect(res.body.cacheHit).toBe(true);
  });

  it('escalates ALLOW to REVIEW when behavior anomaly is detected', async () => {
    const uniqueAddress = createUniqueAddress();

    const first = await withApiKey(request(app)
      .post('/api/v1/aml/check')
      .send({
        address: uniqueAddress,
        chainId: 1,
        amount: '10'
      }));

    expect(first.status).toBe(200);
    expect(first.body.decision).toBe('ALLOW');

    const second = await withApiKey(request(app)
      .post('/api/v1/aml/check')
      .send({
        address: uniqueAddress,
        chainId: 1,
        amount: '1000000'
      }));

    expect(second.status).toBe(200);
    expect(second.body.decision).toBe('REVIEW');
    expect(second.body.behaviorEscalated).toBe(true);
    expect(second.body.behavior).toBeDefined();
  });
});

describe('GET /api/v1/aml/whitelist', () => {
  it('returns whitelist summary', async () => {
    const res = await withApiKey(request(app).get('/api/v1/aml/whitelist'));
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.categories).toBeDefined();
    expect(Array.isArray(res.body.categories)).toBe(true);
  });
});

describe('GET /api/v1/composer/quote', () => {
  const baseQuery = {
    fromChain: '8453',
    toChain: '8453',
    fromToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    toToken: '0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183',
    toAddress: '0x1234567890abcdef1234567890abcdef12345678',
    fromAmount: '1000000'
  };

  it('returns BLOCK when fromAddress is high risk', async () => {
    const res = await request(app)
      .get('/api/v1/composer/quote')
      .query({
        ...baseQuery,
        fromAddress: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96'
      });

    expect(res.status).toBe(403);
    expect(res.body.blocked).toBe(true);
    expect(res.body.aml.decision).toBe('BLOCK');
  });

  it('returns REVIEW confirmation requirement for medium risk address', async () => {
    const res = await request(app)
      .get('/api/v1/composer/quote')
      .query({
        ...baseQuery,
        fromAddress: '0x0000000fe6a514a32abdcdfcc076c85243de899b'
      });

    expect(res.status).toBe(409);
    expect(res.body.requiresReviewConfirmation).toBe(true);
    expect(res.body.aml.decision).toBe('REVIEW');
  });

  it('returns REVIEW for clean address when behavior anomaly is detected', async () => {
    const uniqueAddress = createUniqueAddress();

    await withApiKey(request(app)
      .post('/api/v1/aml/check')
      .send({
        address: uniqueAddress,
        chainId: 8453,
        amount: '10'
      }));

    const res = await request(app)
      .get('/api/v1/composer/quote')
      .query({
        ...baseQuery,
        fromAddress: uniqueAddress,
        fromAmount: '100000000'
      });

    expect(res.status).toBe(409);
    expect(res.body.requiresReviewConfirmation).toBe(true);
    expect(res.body.aml.decision).toBe('REVIEW');
    expect(res.body.aml.behaviorEscalated).toBe(true);
  });
});

describe('GET /api/v1/behavior/profile/:wallet', () => {
  it('returns behavior profile for wallet', async () => {
    const address = createUniqueAddress();

    await withApiKey(request(app)
      .post('/api/v1/aml/check')
      .send({
        address,
        chainId: 1,
        amount: '100'
      }));

    const res = await request(app)
      .get(`/api/v1/behavior/profile/${address}`)
      .query({ chainId: 1, amount: '120' });

    expect(res.status).toBe(200);
    expect(res.body.address).toBe(address.toLowerCase());
    expect(res.body.behavior).toBeDefined();
    expect(typeof res.body.behavior.score).toBe('number');
  });
});

describe('POST /api/v1/aml/appeal', () => {
    it('creates appeal successfully', async () => {
      const uniqueAddress = createUniqueAddress();
      const res = await withApiKey(request(app)
        .post('/api/v1/aml/appeal')
        .send({
          address: uniqueAddress,
          chainId: 1,
          reason: 'This is my personal cold wallet, never interacted with risky addresses',
          contact: 'user@example.com',
        }));
      expect(res.status).toBe(201);
      expect(res.body.ticketId).toMatch(/^APT-/);
      expect(res.body.status).toBe('PENDING');
    });

    it('returns 400 for missing reason', async () => {
      const uniqueAddress = createUniqueAddress();
      const res = await withApiKey(request(app)
        .post('/api/v1/aml/appeal')
        .send({
          address: uniqueAddress,
          chainId: 1,
        }));
      expect(res.status).toBe(400);
    });

  it('returns 400 for invalid address', async () => {
    const res = await withApiKey(request(app)
      .post('/api/v1/aml/appeal')
      .send({
        address: 'bad-address',
        chainId: 1,
        reason: 'test',
      }));
    expect(res.status).toBe(400);
  });
});

describe('Authentication enforcement', () => {
  it('rejects admin request without credentials', async () => {
    const res = await request(app).get('/api/v1/admin/appeals');
    expect(res.status).toBe(401);
  });

  it('rejects AML request without api key', async () => {
    const res = await request(app)
      .post('/api/v1/aml/check')
      .send({
        address: '0x0000000000000000000000000000000000000001',
        chainId: 1,
      });
    expect(res.status).toBe(401);
  });

  it('issues admin JWT for valid login', async () => {
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.expiresIn).toBe(43200);
    expect(res.body.user.username).toBe(ADMIN_USERNAME);
  });

  it('allows admin endpoint with JWT token', async () => {
    const token = await getAdminAccessToken();
    const res = await withAdminToken(request(app).get('/api/v1/admin/appeals'), token);
    expect(res.status).toBe(200);
  });

  it('allows admin endpoint with demo api key', async () => {
    const res = await withApiKey(request(app).get('/api/v1/admin/appeals'));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/admin/appeal/:id/approve', () => {
  it('approves an appeal without creating a duplicate whitelist entry', async () => {
    const uniqueAddress = createUniqueAddress();
    const adminToken = await getAdminAccessToken();

    const appealResponse = await withApiKey(request(app)
      .post('/api/v1/aml/appeal')
      .send({
        address: uniqueAddress,
        chainId: 1,
        reason: 'Please review and approve',
        contact: 'user@example.com',
      }));

    expect(appealResponse.status).toBe(201);

    const appealsResponse = await withAdminToken(request(app).get('/api/v1/admin/appeals'), adminToken);
    const createdAppeal = appealsResponse.body.find((appeal: any) => appeal.address === uniqueAddress.toLowerCase());
    expect(createdAppeal).toBeDefined();

    const approveResponse = await withAdminToken(request(app)
      .post(`/api/v1/admin/appeal/${createdAppeal.id}/approve`)
      .send(), adminToken);

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.success).toBe(true);

    const whitelistResponse = await withAdminToken(request(app).get('/api/v1/admin/whitelist'), adminToken);
    const whitelistEntries = whitelistResponse.body.filter((entry: any) => entry.address === uniqueAddress.toLowerCase());
    expect(whitelistEntries).toHaveLength(1);
    expect(whitelistEntries[0].type).toBe('APPEAL_APPROVED');
    expect(whitelistEntries[0].expiresAt).toBeNull();
  });
});

describe('POST /api/v1/admin/appeal/:id/reject', () => {
  it('rejects an appeal and removes temporary whitelist access from db and cache', async () => {
    const uniqueAddress = createUniqueAddress();
    const cacheService = CacheService.getInstance();
    const adminToken = await getAdminAccessToken();

    const appealResponse = await withApiKey(request(app)
      .post('/api/v1/aml/appeal')
      .send({
        address: uniqueAddress,
        chainId: 1,
        reason: 'Please review and reject',
        contact: 'user@example.com',
      }));

    expect(appealResponse.status).toBe(201);
    expect(cacheService.get(uniqueAddress, 1)).not.toBeNull();

    const appealsResponse = await withAdminToken(request(app).get('/api/v1/admin/appeals'), adminToken);
    const createdAppeal = appealsResponse.body.find((appeal: any) => appeal.address === uniqueAddress.toLowerCase());
    expect(createdAppeal).toBeDefined();

    const rejectResponse = await withAdminToken(request(app)
      .post(`/api/v1/admin/appeal/${createdAppeal.id}/reject`)
      .send({ notes: 'Rejected during test' }), adminToken);

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.success).toBe(true);
    expect(cacheService.get(uniqueAddress, 1)).toBeNull();

    const whitelistResponse = await withAdminToken(request(app).get('/api/v1/admin/whitelist'), adminToken);
    const whitelistEntries = whitelistResponse.body.filter((entry: any) => entry.address === uniqueAddress.toLowerCase());
    expect(whitelistEntries).toHaveLength(0);
  });
});

describe('GET / (root)', () => {
  it('returns API info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('BridgeShield Backend API');
    expect(res.body.version).toBe('0.0.0');
  });
});

describe('404 handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
  });
});
