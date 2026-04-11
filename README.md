# BridgeShield — AML Gateway for LI.FI Cross-Chain Trades

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/easyshellworld/bridgeshield/blob/main/LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/easyshellworld/bridgeshield/pulls)
[![GitHub Repo stars](https://img.shields.io/github/stars/easyshellworld/bridgeshield?style=social)](https://github.com/easyshellworld/bridgeshield/stargazers)
[![Open Issues](https://img.shields.io/github/issues/easyshellworld/bridgeshield)](https://github.com/easyshellworld/bridgeshield/issues)
[![GitHub closed pull requests](https://img.shields.io/github/issues-pr-closed/easyshellworld/bridgeshield)](https://github.com/easyshellworld/bridgeshield/pulls?q=is%3Apr+is%3Aclosed)
[![Last Commit](https://img.shields.io/github/last-commit/easyshellworld/bridgeshield)](https://github.com/easyshellworld/bridgeshield/commits/main)

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0+-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-5A67D8?logo=prisma)](https://prisma.io/)
[![Vitest](https://img.shields.io/badge/Vitest-1.x-6B9DF8?logo=vitest)](https://vitest.io/)

[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=githubactions)](https://github.com/easyshellworld/bridgeshield/actions)
[![Tests](https://img.shields.io/badge/tests-88%20%2B%2021-brightgreen)](https://github.com/easyshellworld/bridgeshield/actions)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

BridgeShield is an Anti-Money Laundering (AML) compliance gateway designed specifically for cross-chain trading platforms like LI.FI. It provides real-time risk assessment, transaction monitoring, and regulatory compliance for decentralized finance (DeFi) transactions.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│   │                 │    │                 │    │                 │  │
│   │  Frontend Demo  │    │   Backend API   │    │ Frontend Admin  │  │
│   │  (Port: 5173)   │◄───┤   (Port: 3000)  │───►│  (Port: 5174)   │  │
│   │                 │    │                 │    │                 │  │
│   └─────────────────┘    └─────────────────┘    └─────────────────┘  │
│                                    │                                  │
│                                    ▼                                  │
│                          ┌─────────────────┐                          │
│                          │   SDK Package  │                          │
│                          │ @bridgeshield/ │                          │
│                          │      sdk       │                          │
│                          └─────────────────┘                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/easyshellworld/bridgeshield
   cd bridgeshield
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **Access the applications:**
   - **Frontend Demo:** http://localhost:5173
   - **Earn Integration Flow Demo:** http://localhost:5173/earn-flow
   - **Backend API:** http://localhost:3000
   - **Frontend Admin:** http://localhost:5174
   - **API Documentation:** http://localhost:3000/api/v1/docs

4. **Stop services:**
   ```bash
   docker-compose down
   ```

### Development Mode

For hot-reload during development:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## 📦 SDK Package

For easy integration into your own applications:

```bash
npm install @bridgeshield/sdk
```

```typescript
import { BridgeShieldClient } from '@bridgeshield/sdk';

const client = new BridgeShieldClient({
  baseUrl: 'https://api.bridgeshield.io',
});

const result = await client.checkAddress({
  address: '0x1234567890abcdef1234567890abcdef12345678',
  chainId: 1,
});

console.log(result.riskLevel); // 'LOW' | 'MEDIUM' | 'HIGH'
console.log(result.decision);  // 'ALLOW' | 'REVIEW' | 'BLOCK'
```

See [packages/sdk/README.md](packages/sdk/README.md) for full documentation.

## 📁 Project Structure

```
bridgeshield/
├── backend/                 # Node.js/TypeScript backend API
│   ├── src/                # Source code
│   ├── prisma/             # Database schema and migrations
│   ├── tests/              # Unit and integration tests
│   ├── Dockerfile           # Production Dockerfile
│   └── package.json
├── frontend-demo/          # Demo interface for users
│   ├── src/                # React/TypeScript source
│   ├── Dockerfile           # Production Dockerfile
│   └── package.json
├── frontend-admin/         # Admin dashboard
│   ├── src/                # React/TypeScript source
│   ├── Dockerfile           # Production Dockerfile
│   └── package.json
├── packages/
│   └── sdk/                 # @bridgeshield/sdk npm package
│       ├── src/             # TypeScript source
│       ├── __tests__/       # Unit tests
│       ├── README.md        # SDK documentation
│       └── package.json
├── docker-compose.yml      # Production services
├── docker-compose.dev.yml  # Development overrides
└── README.md               # This file
```

## 🔧 Manual Setup

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```
   - Set `COMPOSER_API_KEY` (from LI.FI Partner Portal) to enable `/api/v1/composer/quote`.

4. **Initialize database:**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

### Frontend Demo Setup

1. **Navigate to frontend-demo directory:**
   ```bash
   cd frontend-demo
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

### Frontend Admin Setup

1. **Navigate to frontend-admin directory:**
   ```bash
   cd frontend-admin
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

### SDK Development

1. **Navigate to SDK directory:**
   ```bash
   cd packages/sdk
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build:**
   ```bash
   npm run build
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

## 🌐 API Endpoints

### Core AML API (Port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check with service status |
| POST | `/api/v1/aml/check` | Check address risk score |
| GET | `/api/v1/aml/whitelist` | Get whitelist summary |
| POST | `/api/v1/aml/appeal` | Submit appeal for flagged address |
| GET | `/api/v1/aml/appeal/status/:ticketId` | Check appeal status |

### Admin API (Port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/dashboard/stats` | Dashboard statistics |
| GET | `/api/v1/admin/dashboard/risk-trend` | 7-day risk trend |
| GET | `/api/v1/admin/dashboard/risk-distribution` | Risk level distribution |
| GET | `/api/v1/admin/appeals` | List all appeals |
| POST | `/api/v1/admin/appeal/:id/approve` | Approve appeal |
| POST | `/api/v1/admin/appeal/:id/reject` | Reject appeal |
| GET | `/api/v1/admin/whitelist` | List whitelist entries |
| POST | `/api/v1/admin/whitelist` | Add to whitelist |
| DELETE | `/api/v1/admin/whitelist/:id` | Remove from whitelist |
| GET | `/api/v1/admin/logs` | View check logs |

### Earn + Composer Integration API (Port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/earn/vaults` | Proxy vault discovery from Earn Data API |
| GET | `/api/v1/earn/vault/:network/:address` | Proxy single vault detail |
| GET | `/api/v1/earn/portfolio/:wallet` | Proxy wallet portfolio positions |
| GET | `/api/v1/composer/quote` | AML-gated Composer quote (`BLOCK`/`REVIEW`/`ALLOW`) |
| GET | `/api/v1/behavior/profile/:wallet` | C-end wallet behavior profile and anomaly signals |

## 🛡️ Features

### Risk Assessment
- **Wallet Screening:** Check addresses against OFAC, UN, EU sanctions lists
- **Real-time Scoring:** Risk score 0-100 with HIGH/MEDIUM/LOW classification
- **Risk Factors:** Detailed breakdown of risk indicators
- **Caching:** Multi-tier in-memory caching with TTL
- **Behavior Analytics:** C-end behavior anomaly detection (velocity, chain novelty, amount spikes, decision drift)

### Compliance Tools
- **Appeal System:** Users can contest flagged addresses
- **Whitelist Management:** Admin can manage permanent whitelists
- **Audit Trail:** Complete logging of all checks and decisions
- **Transaction Monitoring:** Track checked transactions

### Integration Options
- **REST API:** Full-featured API for direct integration
- **@bridgeshield/sdk:** Official JavaScript/TypeScript SDK
- **Demo Frontend:** Working example with React
- **Admin Dashboard:** Admin panel for managing whitelist and appeals

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test           # Run all tests (88 tests)
```

### SDK Tests
```bash
cd packages/sdk
npm test           # Run SDK tests (21 tests)
```

### Frontend Builds
```bash
cd frontend-demo && npm run build
cd frontend-admin && npm run build
```

## 🐳 Docker Commands

### Build and Run
```bash
# Build all images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Remove all images and volumes
docker-compose down -v --rmi all
```

### Individual Services
```bash
# Build specific service
docker-compose build backend

# Start specific service
docker-compose up -d backend

# View specific service logs
docker-compose logs -f backend
```

## 🔐 Security

### Environment Variables
- `DATABASE_URL`: SQLite/PostgreSQL connection string
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `EARN_DATA_API_BASE_URL`: Earn Data API base URL (default: `https://earn.li.fi`)
- `COMPOSER_API_BASE_URL`: Composer API base URL (default: `https://li.quest`)
- `COMPOSER_API_KEY`: LI.FI Partner Portal API key (required for Composer quote route)
- `BEHAVIOR_*`: Thresholds for C-end behavior risk model (velocity, amount spikes, decision drift)

### Security Features
- Rate limiting on public endpoints
- Input validation on all endpoints
- Helmet security headers
- CORS configuration
- Parameterized queries (Prisma)

## 📊 Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Node.js, TypeScript, Express, Prisma |
| **Database** | SQLite (dev), PostgreSQL (prod) |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **SDK** | TypeScript, tsup (ESM + CJS) |
| **Container** | Docker, Docker Compose |
| **Testing** | Vitest, Supertest |
| **Monitoring** | Winston logging, Health checks |

## 📈 Monitoring & Logging

### Health Checks
- Backend: `GET http://localhost:3000/api/v1/health`
- Returns service status, uptime, and dependency health

### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend

# Follow logs in real-time
docker-compose logs -f backend
```

## 🔄 Development Workflow

1. **Make changes** to source code
2. **Run tests** to ensure functionality
3. **Build Docker images** if needed
4. **Deploy locally** with Docker Compose
5. **Verify functionality** through API and UI

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```
   Error: Port 3000 is already in use
   ```
   Solution: Stop the conflicting service or use a different port in docker-compose.yml

2. **Database connection errors:**
   ```
   Error: Database connection failed
   ```
   Solution: Check DATABASE_URL in environment variables and ensure database is running

3. **Docker build failures:**
   ```
   Error: npm ci failed
   ```
   Solution: Check package.json files for syntax errors

### Getting Help

Check the logs for detailed error information:
```bash
docker-compose logs --tail=100
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **LI.FI** for cross-chain transaction infrastructure
- **React** and **TypeScript** communities
- **Open-source contributors** to all dependencies
