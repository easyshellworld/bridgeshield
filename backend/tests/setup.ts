import { beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
// Use the same dev.db to avoid PrismaClient singleton mismatch
process.env.DATABASE_URL = 'file:./dev.db';

beforeAll(async () => {
  // Ensure schema is pushed to dev.db
  execSync('npx prisma db push --accept-data-loss', {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
  });

  const { PrismaService } = await import('../src/db/prisma-client');
  const { RiskDataLoader } = await import('../src/data/risk-data-loader');

  await PrismaService.getInstance().connect();
  await RiskDataLoader.getInstance().initialize();
});

afterAll(async () => {
  const { PrismaService } = await import('../src/db/prisma-client');
  await PrismaService.getInstance().disconnect();
});
