import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding development database...');

  const whitelistEntries = [
    { address: '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae', chainId: 1, category: 'LIFI_OFFICIAL', description: 'LI.FI Diamond Contract' },
    { address: '0x1f98431c8ad98523631ae4a59f267346ea31f984', chainId: 1, category: 'KNOWN_PROTOCOL', description: 'Uniswap V3 Factory' },
    { address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84', chainId: 1, category: 'KNOWN_PROTOCOL', description: 'Lido stETH' },
    { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', chainId: 1, category: 'TOKEN', description: 'WETH9' },
    { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', chainId: 1, category: 'STABLECOIN', description: 'USDC' },
  ];

  for (const entry of whitelistEntries) {
    await prisma.whitelistEntry.upsert({
      where: { address: entry.address },
      update: {},
      create: entry,
    });
  }
  console.log(`  Seeded ${whitelistEntries.length} whitelist entries`);

  const sampleChecks = [
    { checkId: 'chk_seed_001', address: '0x098b716b8aaf21512996dc57eb0615e2383e2f96', chainId: 1, riskScore: 75, riskLevel: 'HIGH', decision: 'BLOCK', isWhitelisted: false, cacheHit: false, fallbackUsed: false, requestData: '{"address":"0x098b716b8aaf21512996dc57eb0615e2383e2f96","chainId":1}', responseData: '{"riskScore":75,"riskLevel":"HIGH","decision":"BLOCK","riskType":"HACKER","factors":{"baseRisk":75,"behaviorAdjustment":0,"contextAdjustment":0,"details":["Base risk: HACKER (+75)"]}}' },
    { checkId: 'chk_seed_002', address: '0x1f98431c8ad98523631ae4a59f267346ea31f984', chainId: 1, riskScore: 0, riskLevel: 'LOW', decision: 'ALLOW', isWhitelisted: true, cacheHit: false, fallbackUsed: false, requestData: '{"address":"0x1f98431c8ad98523631ae4a59f267346ea31f984","chainId":1}', responseData: '{"riskScore":0,"riskLevel":"LOW","decision":"ALLOW","isWhitelisted":true}' },
    { checkId: 'chk_seed_003', address: '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b', chainId: 1, riskScore: 100, riskLevel: 'HIGH', decision: 'BLOCK', isWhitelisted: false, cacheHit: false, fallbackUsed: false, requestData: '{"address":"0xd90e2f925da726b50c4ed8d0fb90ad053324f31b","chainId":1}', responseData: '{"riskScore":100,"riskLevel":"HIGH","decision":"BLOCK","riskType":"MIXER","factors":{"baseRisk":70,"behaviorAdjustment":35,"contextAdjustment":0,"details":["Base risk: MIXER (+70)","Mixer interaction: +35"]}}' },
    { checkId: 'chk_seed_004', address: '0x629e7da20197a5429d30da36e77d06cdf796b71a', chainId: 1, riskScore: 75, riskLevel: 'HIGH', decision: 'BLOCK', isWhitelisted: false, cacheHit: false, fallbackUsed: false, requestData: '{"address":"0x629e7da20197a5429d30da36e77d06cdf796b71a","chainId":1}', responseData: '{"riskScore":75,"riskLevel":"HIGH","decision":"BLOCK","riskType":"HACKER"}' },
    { checkId: 'chk_seed_005', address: '0x0000000000000000000000000000000000000001', chainId: 1, riskScore: 0, riskLevel: 'LOW', decision: 'ALLOW', isWhitelisted: false, cacheHit: false, fallbackUsed: false, requestData: '{"address":"0x0000000000000000000000000000000000000001","chainId":1}', responseData: '{"riskScore":0,"riskLevel":"LOW","decision":"ALLOW"}' },
    { checkId: 'chk_seed_006', address: '0xdcbeffbecce100cce9e4b153c4e15cb885643193', chainId: 1, riskScore: 85, riskLevel: 'HIGH', decision: 'BLOCK', isWhitelisted: false, cacheHit: false, fallbackUsed: false, requestData: '{"address":"0xdcbeffbecce100cce9e4b153c4e15cb885643193","chainId":1}', responseData: '{"riskScore":85,"riskLevel":"HIGH","decision":"BLOCK","riskType":"SANCTION","isSanctioned":true}' },
    { checkId: 'chk_seed_007', address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84', chainId: 1, riskScore: 0, riskLevel: 'LOW', decision: 'ALLOW', isWhitelisted: true, cacheHit: true, fallbackUsed: false, requestData: '{"address":"0xae7ab96520de3a18e5e111b5eaab095312d7fe84","chainId":1}', responseData: '{"riskScore":0,"riskLevel":"LOW","decision":"ALLOW","isWhitelisted":true}' },
    { checkId: 'chk_seed_008', address: '0xe74b28c2eae8679e3ccc3a94d5d0de83ccb84705', chainId: 1, riskScore: 75, riskLevel: 'HIGH', decision: 'BLOCK', isWhitelisted: false, cacheHit: false, fallbackUsed: false, requestData: '{"address":"0xe74b28c2eae8679e3ccc3a94d5d0de83ccb84705","chainId":1}', responseData: '{"riskScore":75,"riskLevel":"HIGH","decision":"BLOCK","riskType":"HACKER"}' },
  ];

  for (const check of sampleChecks) {
    await prisma.checkLog.upsert({
      where: { checkId: check.checkId },
      update: {},
      create: check,
    });
  }
  console.log(`  Seeded ${sampleChecks.length} check logs`);

  const sampleAppeals = [
    { ticketId: 'APT-20260409-001', address: '0x1234567890abcdef1234567890abcdef12345678', chainId: 1, reason: 'This is my personal wallet, incorrectly flagged as hacker-associated. I have never engaged in malicious activity.', contact: 'user@example.com', status: 'PENDING', estimatedReviewAt: new Date(Date.now() + 7 * 86400000) },
    { ticketId: 'APT-20260408-001', address: '0xabcdef1234567890abcdef1234567890abcdef12', chainId: 1, reason: 'This is our DeFi protocol contract address. It was flagged incorrectly.', contact: 'admin@protocol.xyz', status: 'PENDING', estimatedReviewAt: new Date(Date.now() + 5 * 86400000) },
    { ticketId: 'APT-20260407-001', address: '0x9876543210fedcba9876543210fedcba98765432', chainId: 1, reason: 'I received funds from a friend, did not know they were from a mixer.', status: 'APPROVED', reviewedAt: new Date(Date.now() - 2 * 86400000), reviewer: 'admin', decision: 'APPROVED', notes: 'Legitimate user, no malicious activity found' },
    { ticketId: 'APT-20260406-001', address: '0xfedcba0987654321fedcba0987654321fedcba09', chainId: 1, reason: 'This is my personal wallet, not associated with any scams.', status: 'REJECTED', reviewedAt: new Date(Date.now() - 3 * 86400000), reviewer: 'admin', decision: 'REJECTED', notes: 'Address directly associated with multiple scam transactions' },
  ];

  for (const appeal of sampleAppeals) {
    await prisma.appeal.upsert({
      where: { ticketId: appeal.ticketId },
      update: {},
      create: appeal,
    });
  }
  console.log(`  Seeded ${sampleAppeals.length} appeals`);

  console.log('Seed complete!');
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
