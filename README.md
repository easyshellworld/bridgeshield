# BridgeShield — AML Gateway for LI.FI Cross-Chain Trades

BridgeShield is an Anti-Money Laundering (AML) compliance gateway designed specifically for cross-chain trading platforms like LI.FI. It provides real-time risk assessment, transaction monitoring, and regulatory compliance for decentralized finance (DeFi) transactions.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  Frontend Demo  │    │   Backend API   │    │ Frontend Admin  │
│  (Port: 5173)   │◄───┤   (Port: 3000)  │───►│  (Port: 5174)   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    Docker Compose                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Using Docker Compose (Recommended)

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd bridgeshield
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **Access the applications:**
   - **Frontend Demo:** http://localhost:5173
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

## 📁 Project Structure

```
bridgeshield/
├── backend/                 # Node.js/TypeScript backend API
│   ├── src/                # Source code
│   ├── prisma/             # Database schema and migrations
│   ├── Dockerfile          # Production Dockerfile
│   └── package.json
├── frontend-demo/          # Demo interface for users
│   ├── src/                # Vue.js/TypeScript source
│   ├── Dockerfile          # Production Dockerfile
│   └── package.json
├── frontend-admin/         # Admin dashboard
│   ├── src/                # Vue.js/TypeScript source
│   ├── Dockerfile          # Production Dockerfile
│   └── package.json
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

## 🌐 API Endpoints

### Core API (Port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/docs` | OpenAPI documentation |
| POST | `/api/v1/transactions/analyze` | Analyze transaction for AML risks |
| GET | `/api/v1/transactions/:id` | Get transaction details |
| GET | `/api/v1/transactions` | List transactions with filtering |
| POST | `/api/v1/addresses/check` | Check wallet address against risk databases |
| GET | `/api/v1/addresses/:address` | Get address risk profile |
| GET | `/api/v1/compliance/rules` | List active compliance rules |
| POST | `/api/v1/compliance/rules` | Create new compliance rule |
| GET | `/api/v1/reports/risk-summary` | Generate risk summary report |

### WebSocket Endpoints

- `/ws/transactions` - Real-time transaction monitoring
- `/ws/alerts` - Compliance alert notifications

## 🛡️ Features

### Risk Assessment
- **Wallet Screening:** Check addresses against OFAC, UN, EU sanctions lists
- **Transaction Pattern Analysis:** Detect suspicious transaction patterns
- **Cross-chain Tracking:** Monitor fund flows across multiple blockchains
- **Risk Scoring:** Assign risk scores based on multiple factors

### Compliance Tools
- **Custom Rules Engine:** Define custom compliance rules
- **Audit Trail:** Comprehensive logging of all compliance decisions
- **Report Generation:** Generate regulatory compliance reports
- **Alert System:** Real-time alerts for high-risk transactions

### Integration
- **LI.FI Compatible:** Designed specifically for LI.FI cross-chain transactions
- **REST API:** Full-featured API for integration with other systems
- **WebSocket Support:** Real-time updates and notifications

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test           # Run unit tests
npm run test:e2e   # Run end-to-end tests
```

### Frontend Tests
```bash
cd frontend-demo
npm test           # Run component tests

cd ../frontend-admin
npm test           # Run component tests
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
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token generation
- `SANCTIONS_API_KEY`: API key for sanctions list checking
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

### Security Best Practices
- All API endpoints require authentication
- Sensitive data is encrypted at rest
- Regular security audits and dependency updates
- Rate limiting on public endpoints

## 📊 Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Node.js, TypeScript, Express, Prisma |
| **Database** | SQLite (development), PostgreSQL (production) |
| **Frontend** | Vue.js 3, TypeScript, Vite, Tailwind CSS |
| **Container** | Docker, Docker Compose |
| **API** | REST, WebSocket, OpenAPI/Swagger |
| **Testing** | Jest, Vitest, Supertest |
| **Monitoring** | Winston logging, Health checks |

## 📈 Monitoring & Logging

### Health Checks
- Backend: `GET http://localhost:3000/api/v1/health`
- Returns service status and uptime

### Logging Levels
- `DEBUG`: Detailed debugging information
- `INFO`: General operational information
- `WARN`: Warning conditions
- `ERROR`: Error conditions

### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend

# Follow logs in real-time
docker-compose logs -f
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

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- **LI.FI** for cross-chain transaction infrastructure
- **Vue.js** and **TypeScript** communities
- **Open-source contributors** to all dependencies

---

**BridgeShield** is developed with ❤️ for secure and compliant DeFi transactions.