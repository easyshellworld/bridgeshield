import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { PrismaService } from '../../src/db/prisma-client';
import { CacheService } from '../../src/services/cache-service';

let app: Express;
let uniqueCounter = 0;

const createUniqueAddress = () => {
  uniqueCounter += 1;
  return `0x${(Date.now() + uniqueCounter).toString(16).padStart(40, '0')}`.slice(0, 42);
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
    const res = await request(app)
      .post('/api/v1/aml/check')
      .send({
        address: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96',
        chainId: 1,
      });
    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('BLOCK');
    expect(res.body.riskScore).toBeGreaterThanOrEqual(70);
    expect(res.body.riskLevel).toBe('HIGH');
  });

  it('returns ALLOW for whitelisted address', async () => {
    const res = await request(app)
      .post('/api/v1/aml/check')
      .send({
        address: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        chainId: 1,
      });
    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.isWhitelisted).toBe(true);
    expect(res.body.riskScore).toBe(0);
  });

  it('returns ALLOW for clean unknown address', async () => {
    const res = await request(app)
      .post('/api/v1/aml/check')
      .send({
        address: '0x0000000000000000000000000000000000000001',
        chainId: 1,
      });
    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.riskScore).toBe(0);
  });

  it('returns 400 for invalid address', async () => {
    const res = await request(app)
      .post('/api/v1/aml/check')
      .send({ address: 'not-valid', chainId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 400 for missing address', async () => {
    const res = await request(app)
      .post('/api/v1/aml/check')
      .send({ chainId: 1 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing chainId', async () => {
    const res = await request(app)
      .post('/api/v1/aml/check')
      .send({ address: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96' });
    expect(res.status).toBe(400);
  });

  it('returns cached result on second call', async () => {
    const addr = '0x098B716B8Aaf21512996dC57EB0615e2383E2f96';
    await request(app).post('/api/v1/aml/check').send({ address: addr, chainId: 1 });

    const res = await request(app)
      .post('/api/v1/aml/check')
      .send({ address: addr, chainId: 1 });
    expect(res.status).toBe(200);
    expect(res.body.cacheHit).toBe(true);
  });
});

describe('GET /api/v1/aml/whitelist', () => {
  it('returns whitelist summary', async () => {
    const res = await request(app).get('/api/v1/aml/whitelist');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.categories).toBeDefined();
    expect(Array.isArray(res.body.categories)).toBe(true);
  });
});

describe('POST /api/v1/aml/appeal', () => {
    it('creates appeal successfully', async () => {
      const uniqueAddress = createUniqueAddress();
      const res = await request(app)
        .post('/api/v1/aml/appeal')
        .send({
          address: uniqueAddress,
          chainId: 1,
          reason: 'This is my personal cold wallet, never interacted with risky addresses',
          contact: 'user@example.com',
        });
      expect(res.status).toBe(201);
      expect(res.body.ticketId).toMatch(/^APT-/);
      expect(res.body.status).toBe('PENDING');
    });

    it('returns 400 for missing reason', async () => {
      const uniqueAddress = createUniqueAddress();
      const res = await request(app)
        .post('/api/v1/aml/appeal')
        .send({
          address: uniqueAddress,
          chainId: 1,
        });
      expect(res.status).toBe(400);
    });

  it('returns 400 for invalid address', async () => {
    const res = await request(app)
      .post('/api/v1/aml/appeal')
      .send({
        address: 'bad-address',
        chainId: 1,
        reason: 'test',
      });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/admin/appeal/:id/approve', () => {
  it('approves an appeal without creating a duplicate whitelist entry', async () => {
    const uniqueAddress = createUniqueAddress();

    const appealResponse = await request(app)
      .post('/api/v1/aml/appeal')
      .send({
        address: uniqueAddress,
        chainId: 1,
        reason: 'Please review and approve',
        contact: 'user@example.com',
      });

    expect(appealResponse.status).toBe(201);

    const appealsResponse = await request(app).get('/api/v1/admin/appeals');
    const createdAppeal = appealsResponse.body.find((appeal: any) => appeal.address === uniqueAddress.toLowerCase());
    expect(createdAppeal).toBeDefined();

    const approveResponse = await request(app)
      .post(`/api/v1/admin/appeal/${createdAppeal.id}/approve`)
      .send();

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.success).toBe(true);

    const whitelistResponse = await request(app).get('/api/v1/admin/whitelist');
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

    const appealResponse = await request(app)
      .post('/api/v1/aml/appeal')
      .send({
        address: uniqueAddress,
        chainId: 1,
        reason: 'Please review and reject',
        contact: 'user@example.com',
      });

    expect(appealResponse.status).toBe(201);
    expect(cacheService.get(uniqueAddress, 1)).not.toBeNull();

    const appealsResponse = await request(app).get('/api/v1/admin/appeals');
    const createdAppeal = appealsResponse.body.find((appeal: any) => appeal.address === uniqueAddress.toLowerCase());
    expect(createdAppeal).toBeDefined();

    const rejectResponse = await request(app)
      .post(`/api/v1/admin/appeal/${createdAppeal.id}/reject`)
      .send({ notes: 'Rejected during test' });

    expect(rejectResponse.status).toBe(200);
    expect(rejectResponse.body.success).toBe(true);
    expect(cacheService.get(uniqueAddress, 1)).toBeNull();

    const whitelistResponse = await request(app).get('/api/v1/admin/whitelist');
    const whitelistEntries = whitelistResponse.body.filter((entry: any) => entry.address === uniqueAddress.toLowerCase());
    expect(whitelistEntries).toHaveLength(0);
  });
});

describe('GET / (root)', () => {
  it('returns API info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('BridgeShield Backend API');
    expect(res.body.version).toBe('2.0.0');
  });
});

describe('404 handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
  });
});
