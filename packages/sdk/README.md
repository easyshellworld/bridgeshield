# @bridgeshield/sdk

[![npm version](https://img.shields.io/npm/v/@bridgeshield/sdk.svg)](https://www.npmjs.com/package/@bridgeshield/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

Official JavaScript/TypeScript SDK for BridgeShield AML Gateway. Check blockchain addresses for AML risk, submit appeals, and integrate LI.FI compliance into your DeFi applications.

## Features

- **TypeScript First**: Full TypeScript support with complete type definitions
- **Tree Shakeable**: ESM and CJS builds optimized for bundlers
- **Error Handling**: Hierarchical error classes for precise error handling
- **Isomorphic**: Works in both Node.js (18+) and browsers
- **Zero Dependencies**: Lightweight with no external runtime dependencies

## Installation

```bash
# npm
npm install @bridgeshield/sdk

# yarn
yarn add @bridgeshield/sdk

# pnpm
pnpm add @bridgeshield/sdk
```

## Quick Start

```typescript
import { BridgeShieldClient } from '@bridgeshield/sdk';

const client = new BridgeShieldClient({
  baseUrl: 'https://api.bridgeshield.io',
  apiKey: process.env.BRIDGESHIELD_API_KEY,
});

const result = await client.checkAddress({
  address: '0x1234567890abcdef1234567890abcdef12345678',
  chainId: 1,
});

console.log(result.riskLevel); // 'LOW' | 'MEDIUM' | 'HIGH'
console.log(result.decision);  // 'ALLOW' | 'REVIEW' | 'BLOCK'
```

## API Reference

### Constructor

```typescript
const client = new BridgeShieldClient({
  baseUrl: string;        // Required: API base URL
  apiKey?: string;         // API key for protected AML/admin endpoints
  timeout?: number;        // Optional: Request timeout in ms (default: 5000)
});
```

### Methods

#### `checkAddress(params)`

Check a blockchain address for AML risk.

```typescript
const result = await client.checkAddress({
  address: string;        // Required: Address to check
  chainId?: number;       // Optional: Chain ID (default: 1)
  amount?: string;        // Optional: Transaction amount
  senderAddress?: string; // Optional: Sender address
});

// Response
interface CheckAddressResponse {
  checkId: string;
  address: string;
  chainId: number;
  riskScore: number;      // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK';
  riskType?: string;
  factors?: { details?: string[] };
  isWhitelisted: boolean;
  cacheHit: boolean;
  cacheTier?: string;
  fallback?: boolean;
  fallbackReason?: string;
}
```

#### `submitAppeal(params)`

Submit an appeal for an incorrectly flagged address.

```typescript
const result = await client.submitAppeal({
  address: string;        // Required: Address to appeal
  reason: string;         // Required: Reason for appeal
  contact?: string;       // Optional: Contact email
});

// Response
interface SubmitAppealResponse {
  ticketId: string;
  address: string;
  chainId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  estimatedReviewAt: string;
  message: string;
  nextSteps: string[];
}
```

#### `getAppealStatus(ticketId)`

Check the status of an appeal.

```typescript
const result = await client.getAppealStatus('APT-20260410-001');

// Response
interface AppealStatusResponse {
  ticketId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  estimatedReviewAt: string;
  address?: string;
  chainId?: number;
  reason?: string;
  contact?: string;
  reviewedAt?: string;
  reviewer?: string;
  decision?: 'APPROVED' | 'REJECTED';
  notes?: string;
}
```

#### `getWhitelistSummary()`

Get whitelist statistics.

```typescript
const result = await client.getWhitelistSummary();

// Response
interface WhitelistSummary {
  total: number;
  categories: Array<{ category: string; count: number }>;
  lastSyncedAt: string;
  version: string;
}
```

#### `healthCheck()`

Check API health status.

```typescript
const result = await client.healthCheck();

// Response
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: string;
  services: {
    database: { healthy: boolean; status: string };
    riskData: { healthy: boolean; status: string };
    cache: { healthy: boolean; status: string };
    redis: string;
  };
}
```

### Utility Methods

```typescript
client.setBaseUrl('https://new-api.bridgeshield.io');
client.setApiKey('your-api-key');
```

## Error Handling

The SDK provides hierarchical error classes for precise error handling:

```typescript
import {
  BridgeShieldClient,
  BridgeShieldError,
  ApiError,
  NetworkError,
  ValidationError,
} from '@bridgeshield/sdk';

try {
  const result = await client.checkAddress({ address: '0x...' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Invalid input:', error.message);
    console.log('Field:', error.field);
  } else if (error instanceof ApiError) {
    console.log('API error:', error.statusCode, error.message);
    console.log('Response:', error.response);
  } else if (error instanceof NetworkError) {
    console.log('Network issue:', error.message);
  } else if (error instanceof BridgeShieldError) {
    console.log('General error:', error.message);
  }
}
```

### Error Types

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| `ValidationError` | 400 | Invalid input parameters |
| `ApiError` | 4xx/5xx | Server responded with error |
| `NetworkError` | - | Network failure or timeout |

## Examples

### Check Multiple Addresses

```typescript
const addresses = [
  '0x098B716B8Aaf21512996dC57EB0615e2383E2f96',
  '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b',
  '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
];

const results = await Promise.all(
  addresses.map(addr => client.checkAddress({ address: addr }))
);

results.forEach((result, i) => {
  console.log(`${addresses[i]}: ${result.decision}`);
});
```

### Submit Appeal with Contact

```typescript
try {
  const appeal = await client.submitAppeal({
    address: '0x123...',
    reason: 'This is my personal wallet, not associated with any hack.',
    contact: 'user@example.com',
  });

  console.log(`Appeal submitted: ${appeal.ticketId}`);
  console.log(`Status: ${appeal.status}`);
  console.log(`Estimated review: ${appeal.estimatedReviewAt}`);
} catch (error) {
  if (error instanceof ApiError && error.statusCode === 409) {
    console.log('Appeal already exists for this address');
  }
}
```

### Check Appeal Status

```typescript
const status = await client.getAppealStatus('APT-20260410-001');

if (status.status === 'APPROVED') {
  console.log('Appeal approved!');
} else if (status.status === 'REJECTED') {
  console.log('Appeal rejected');
  console.log('Notes:', status.notes);
} else {
  console.log('Still pending...');
}
```

### Monitor API Health

```typescript
const health = await client.healthCheck();

if (health.status === 'healthy') {
  console.log('All systems operational');
} else if (health.status === 'degraded') {
  console.log('System degraded');
} else {
  console.log('System unavailable');
}
```

## Configuration

### Node.js 18+

Node.js 18+ has native `fetch` support. No additional configuration needed.

### Browser

Works with any modern browser that supports `fetch` API.

### API Keys

Protected AML/admin endpoints require an API key. Set it on client construction:

```typescript
const client = new BridgeShieldClient({
  baseUrl: 'https://api.bridgeshield.io',
  apiKey: process.env.BRIDGESHIELD_API_KEY,
});
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [Documentation](https://docs.bridgeshield.io)
- [API Reference](https://api.bridgeshield.io/api/v1/docs)
- [BridgeShield Website](https://bridgeshield.io)
