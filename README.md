# Bonitah Financial Network (BFN)

A production-quality Web3 monorepo for financial education, decentralized savings, and community investing on the Base Sepolia network (chain ID `84532`). The blockchain is the single source of truth for all financial state.

**BFN empowers users to:**

- **Save & Earn**: Deposit funds in decentralized savings vaults with transparent yield using real USDC
- **Set Goals**: Create and track financial goals with milestone rewards
- **Learn Together**: Access financial education with certificates and achievements
- **Invest as Community**: Join investment circles and collaborative funding pools
- **Govern Collectively**: Participate in protocol governance with reputation-weighted voting

## 🔗 Real Asset Integration

**BFN uses REAL financial assets - no mock data or test tokens:**

- **Token**: Circle's official USDC on Base Sepolia (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
- **Network**: Base Sepolia testnet (Chain ID: 84532)
- **Data**: All financial values read directly from deployed smart contracts
- **Transactions**: All state changes require real wallet signatures

_Note: While Base Sepolia is a testnet, the USDC tokens and smart contracts function identically to mainnet with real transaction signing and on-chain state._

---

## 📁 Monorepo Structure

| Directory            | Purpose                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `contracts/`         | Foundry project: Registry, SavingsVault, CommunityTreasury, Education, Governance |
| `frontend/`          | Next.js app (App Router, TypeScript, Tailwind, wagmi/viem/RainbowKit)             |
| `backend/`           | NestJS API, SIWE auth, event indexer, AI assistant, IPFS service                  |
| `shared/`            | Shared TypeScript types, ABIs, contract addresses, and zod schemas                |
| `docs/`              | README, API docs, contract docs, deployment and developer guides                  |
| `docker/`            | Dockerfiles and `docker-compose.yml`                                              |
| `.github/workflows/` | CI workflows (lint, test, build)                                                  |
| `scripts/`           | Tooling, codegen, secret scanning, coverage aggregation                           |
| `deployment/`        | Base Sepolia deployment scripts and recorded contract addresses                   |
| `tests/`             | Cross-cutting and end-to-end test suites                                          |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** `>=20.0.0` ([Download](https://nodejs.org/))
- **pnpm** `>=9.0.0` ([Install](https://pnpm.io/installation))
- **Foundry** (for contract development) ([Install](https://getfoundry.sh/))
- **Docker** & **Docker Compose** (for full-stack development)
- **Git** with submodules support

### 1. Clone and Setup

```bash
# Clone the repository with submodules
git clone --recurse-submodules https://github.com/your-org/bonitah-financial-network.git
cd bonitah-financial-network

# Install all workspace dependencies
pnpm install

# Build shared package first (required by all other packages)
pnpm --filter shared build
```

### 2. Environment Configuration

Each service requires environment variables. Copy example files and configure:

```bash
# Backend environment
cp backend/.env.example backend/.env
# Configure: DATABASE_URL, REDIS_URL, JWT_SECRET, BASE_SEPOLIA_RPC_URL

# Contracts environment
cp contracts/.env.example contracts/.env
# Configure: PRIVATE_KEY, BASE_SEPOLIA_RPC_URL, BASESCAN_API_KEY

# Frontend environment
cp frontend/.env.example frontend/.env.local
# Configure: NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```

### 3. Database Setup

```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Initialize database
cd backend
pnpm prisma migrate dev
pnpm prisma db seed
```

### 4. Smart Contract Deployment

```bash
cd contracts

# Compile and test contracts
forge build
forge test

# Deploy to Base Sepolia (requires funded wallet)
pnpm deploy:sepolia
```

### 5. Start Development Services

```bash
# Terminal 1: Backend API
cd backend && pnpm dev

# Terminal 2: Frontend
cd frontend && pnpm dev

# Terminal 3: Contract development (optional)
cd contracts && forge test --watch
```

**Access the application:**

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/docs

---

## 🛠️ Development Workflow

### Workspace Scripts

Run from the repository root:

```bash
pnpm install        # install workspace dependencies
pnpm lint           # ESLint + Prettier check across the monorepo
pnpm lint:fix       # auto-fix lint and formatting issues
pnpm format         # write Prettier formatting
pnpm typecheck      # type-check all workspace packages
pnpm test           # run tests across all workspace packages
pnpm build          # build all workspace packages
pnpm clean          # clean build artifacts across all packages
```

### Per-Service Commands

#### Contracts (`contracts/`)

```bash
cd contracts

# Development
forge build                 # compile contracts
forge test                  # run all tests
forge test --gas-report     # test with gas usage
forge coverage              # generate coverage report

# Deployment
pnpm deploy:sepolia         # deploy to Base Sepolia
pnpm verify:deployment      # verify deployed contracts
```

#### Backend (`backend/`)

```bash
cd backend

# Development
pnpm dev                    # start development server
pnpm test                   # run unit tests
pnpm test:e2e              # run end-to-end tests
pnpm test:cov              # test with coverage

# Database
pnpm prisma:generate       # generate Prisma client
pnpm prisma:migrate        # run migrations
pnpm prisma:seed           # seed database
pnpm prisma:studio         # open Prisma Studio

# Production
pnpm build                 # build for production
pnpm start                 # start production server
```

#### Frontend (`frontend/`)

```bash
cd frontend

# Development
pnpm dev                   # start development server
pnpm test                  # run unit tests
pnpm test:e2e              # run Playwright e2e tests
pnpm storybook             # start Storybook

# Production
pnpm build                 # build for production
pnpm start                 # start production server
pnpm analyze               # analyze bundle size
```

#### Shared (`shared/`)

```bash
cd shared

# Build (required before using in other packages)
pnpm build                 # generate types and build
pnpm watch                 # build in watch mode
```

---

## 🌐 Environment Variables

### Required Environment Variables

#### Backend (`.env`)

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/bfn_dev"
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-super-secret-jwt-key"
SIWE_DOMAIN="localhost"

# Blockchain
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
INDEXER_START_BLOCK="12345678"

# External Services
OPENAI_API_KEY="sk-..."
PINATA_JWT="eyJ..."

# Server
PORT="3001"
NODE_ENV="development"
```

#### Contracts (`.env`)

```bash
# Deployment
PRIVATE_KEY="0x..."
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"
BASESCAN_API_KEY="your-basescan-api-key"

# Optional: Tenderly for debugging
TENDERLY_PROJECT="your-project"
TENDERLY_USERNAME="your-username"
```

#### Frontend (`.env.local`)

```bash
# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your-project-id"

# Backend API
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Analytics (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
```

---

## 🐳 Docker Development

### Full Stack with Docker Compose

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Rebuild and restart
docker compose up -d --build
```

### Individual Services

```bash
# Database services only
docker compose up -d postgres redis

# Backend only
docker compose up -d backend

# Frontend only
docker compose up -d frontend
```

---

## 🧪 Testing

### Contract Tests

```bash
cd contracts
forge test -vv                    # run with verbosity
forge test --gas-report           # include gas usage
forge test --match-contract Registry  # test specific contract
```

### Backend Tests

```bash
cd backend
pnpm test                         # unit tests
pnpm test:e2e                     # end-to-end tests
pnpm test:cov                     # with coverage report
```

### Frontend Tests

```bash
cd frontend
pnpm test                         # unit & component tests
pnpm test:e2e                     # Playwright e2e tests
pnpm test:e2e --ui                # with Playwright UI
```

### Cross-Package Tests

```bash
# From repo root
pnpm test                         # run all test suites
pnpm test:ci                      # CI-optimized test run
```

---

## 📦 Building & Deployment

### Local Build

```bash
# Build all packages
pnpm build

# Build specific packages
pnpm --filter contracts build
pnpm --filter shared build
pnpm --filter backend build
pnpm --filter frontend build
```

### Production Deployment

1. **Deploy Smart Contracts**

   ```bash
   cd contracts
   pnpm deploy:sepolia
   ```

2. **Build & Deploy Backend**

   ```bash
   cd backend
   pnpm build
   # Deploy to your preferred platform (AWS, Railway, etc.)
   ```

3. **Build & Deploy Frontend**
   ```bash
   cd frontend
   pnpm build
   # Deploy to Vercel, Netlify, or CDN
   ```

---

## 🔧 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clear all node_modules and reinstall
rm -rf node_modules */node_modules
pnpm install

# Clear build caches
pnpm clean
pnpm build
```

#### Database Issues

```bash
# Reset database
cd backend
pnpm prisma migrate reset
pnpm prisma db seed
```

#### Contract Deployment Issues

```bash
# Check network connection and gas
cast client $BASE_SEPOLIA_RPC_URL
cast balance $YOUR_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL

# Clean and rebuild
cd contracts
forge clean
forge build
```

#### Frontend Connection Issues

- Ensure wallet is connected to Base Sepolia (Chain ID: 84532)
- Check that contract addresses are updated in `shared/src/addresses.ts`
- Verify RPC endpoint is accessible

### Getting Help

- **Documentation**: Check the `docs/` directory for detailed guides
- **Issues**: Open an issue on GitHub with reproduction steps
- **Community**: Join our Discord for community support
- **Email**: For private inquiries, contact support@bonitah.finance

---

## 📋 Project Status

| Component       | Status      | Test Coverage | Notes                     |
| --------------- | ----------- | ------------- | ------------------------- |
| Smart Contracts | ✅ Complete | >90%          | All 5 contracts deployed  |
| Backend API     | ✅ Complete | >80%          | Full SIWE auth & indexing |
| Frontend App    | ✅ Complete | >80%          | All pages implemented     |
| Documentation   | ✅ Complete | N/A           | API & contract docs       |
| CI/CD Pipeline  | ✅ Complete | N/A           | GitHub Actions            |
| Docker Setup    | ✅ Complete | N/A           | Multi-stage builds        |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the full test suite: `pnpm test`
5. Commit with conventional commit messages: `git commit -m 'feat: add amazing feature'`
6. Push to your branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines

- Follow the existing code style and conventions
- Add tests for new functionality
- Update documentation as needed
- Ensure all CI checks pass
- Keep commits focused and atomic

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Base**: For providing the Layer 2 infrastructure
- **OpenZeppelin**: For secure smart contract primitives
- **RainbowKit**: For excellent wallet connection UX
- **NestJS**: For the robust backend framework
- **Next.js**: For the powerful React framework
- **Foundry**: For the best-in-class Solidity tooling

Built with ❤️ by the BFN team
