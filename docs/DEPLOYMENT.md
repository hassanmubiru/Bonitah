# Bonitah Financial Network - Deployment Guide

This guide provides step-by-step instructions for deploying the complete Bonitah Financial Network (BFN) system to production. The deployment process includes smart contract deployment to Base Sepolia and service deployment using Docker Compose.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Base Sepolia Contract Deployment](#base-sepolia-contract-deployment)
4. [Service Deployment](#service-deployment)
5. [Verification and Testing](#verification-and-testing)
6. [Post-Deployment Configuration](#post-deployment-configuration)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: >= 20.0.0
- **pnpm**: >= 9.0.0 (package manager)
- **Docker**: >= 24.0.0
- **Docker Compose**: >= 2.0.0
- **Git**: Latest stable version
- **PostgreSQL**: 15+ (if running without Docker)
- **Redis**: 7+ (if running without Docker)

### Network Requirements

- Access to Base Sepolia RPC endpoint
- Internet connectivity for IPFS (Pinata) services
- Domain and SSL certificate (for production deployment)

### Required Accounts and Keys

1. **Base Sepolia Wallet**:
   - Private key with sufficient ETH for deployment gas
   - This wallet will be the admin for all contracts

2. **OpenAI API Key**:
   - Valid API key for the AI assistant functionality
   - Sufficient credits for expected usage

3. **Pinata IPFS Account**:
   - JWT token for IPFS pinning service
   - Gateway URL for content retrieval

4. **Certificate Issuer Account**:
   - Separate private key for issuing education certificates
   - Will be granted ISSUER_ROLE on Education contract

### Development Tools

Install the required tools:

```bash
# Install Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Install pnpm
npm install -g pnpm@9

# Verify versions
node --version    # Should be >= 20.0.0
pnpm --version    # Should be >= 9.0.0
docker --version  # Should be >= 24.0.0
docker compose version  # Should be >= 2.0.0
```

## Environment Setup

### 1. Clone and Setup Repository

```bash
# Clone the repository
git clone <repository-url> bonitah-financial-network
cd bonitah-financial-network

# Install dependencies
pnpm install

# Build shared package
pnpm build

# Verify build
pnpm lint
pnpm typecheck
```

### 2. Configure Environment Variables

Create environment files for each service:

#### Backend Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your production values:

```bash
# Runtime
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# HTTP
CORS_ORIGINS=https://yourdomain.com

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/bfn_production

# Redis
REDIS_URL=redis://localhost:6379

# Blockchain (Base Sepolia)
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
CHAIN_ID=84532

# Auth - Generate a strong 32+ character secret
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
JWT_EXPIRES_IN=24h

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here

# IPFS (Pinata)
PINATA_JWT=your-pinata-jwt-token-here
PINATA_GATEWAY=https://gateway.pinata.cloud

# Certificate issuance
ISSUER_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

#### Frontend Environment (if needed)

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=84532
```

### 3. Foundry Environment

Create `contracts/.env`:

```bash
# Deployment wallet private key (with ETH for gas)
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Base Sepolia RPC
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Optional: Etherscan API key for verification
BASESCAN_API_KEY=your-basescan-api-key
```

## Base Sepolia Contract Deployment

### 1. Prepare Deployment

Ensure you have sufficient ETH in your deployment wallet:

```bash
# Check balance (replace with your address)
cast balance 0xYourDeploymentAddress --rpc-url https://sepolia.base.org

# You need at least 0.1 ETH for deployment gas
```

### 2. Deploy Mock ERC20 Token (Test Environment)

For testing, deploy a mock stablecoin:

```bash
cd contracts

# Deploy mock ERC20
forge script script/DeployMockToken.s.sol:DeployMockToken \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# Note the deployed token address
```

### 3. Deploy BFN Contracts

Deploy all BFN contracts with UUPS proxies:

```bash
cd contracts

# Deploy all contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# This will deploy:
# - Registry (with UUPS proxy)
# - SavingsVault (with UUPS proxy)
# - CommunityTreasury (with UUPS proxy)
# - Education (with UUPS proxy)  
# - Governance (with UUPS proxy)
```

### 4. Update Shared Package

The deployment script should automatically update the shared package, but verify:

```bash
# Check that addresses were updated
cat shared/src/addresses.ts

# Rebuild shared package with new addresses
cd shared
pnpm build
```

### 5. Configure Contract Roles

Grant necessary roles to accounts:

```bash
cd contracts

# Grant VERIFIER_ROLE to verification account
forge script script/ConfigureRoles.s.sol:ConfigureRoles \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast

# Grant ISSUER_ROLE to certificate issuer account
cast send <EDUCATION_CONTRACT_ADDRESS> \
  "grantRole(bytes32,address)" \
  $(cast keccak256 "ISSUER_ROLE") \
  <ISSUER_ACCOUNT_ADDRESS> \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY
```

### 6. Verify Deployment

```bash
# Verify all contracts are deployed and initialized
forge script script/VerifyDeployment.s.sol:VerifyDeployment \
  --rpc-url https://sepolia.base.org

# Check contract verification on Basescan
# Visit: https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>
```

## Service Deployment

### 1. Database Setup

#### Using Docker Compose (Recommended)

The docker-compose.yml includes PostgreSQL and Redis:

```bash
# Start database services only
docker compose up -d postgres redis

# Wait for services to be ready
docker compose logs postgres
docker compose logs redis
```

#### Manual Setup

If running databases separately:

```bash
# PostgreSQL
createdb bfn_production
psql bfn_production -c "CREATE USER bfn_user WITH PASSWORD 'secure_password';"
psql bfn_production -c "GRANT ALL PRIVILEGES ON DATABASE bfn_production TO bfn_user;"

# Redis
redis-server --daemonize yes
```

### 2. Backend Deployment

#### Using Docker Compose

```bash
# Build and start backend
docker compose up -d backend

# Check logs
docker compose logs -f backend
```

#### Manual Deployment

```bash
cd backend

# Install production dependencies
pnpm install --prod

# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm prisma:migrate

# Build the application
pnpm build

# Start the application
pnpm start:prod
```

### 3. Frontend Deployment

#### Using Docker Compose

```bash
# Build and start frontend
docker compose up -d frontend

# Check logs
docker compose logs -f frontend
```

#### Manual Deployment

```bash
cd frontend

# Install production dependencies
pnpm install --prod

# Build the application
pnpm build

# Start the application
pnpm start
```

### 4. Full Stack Deployment

Deploy all services together:

```bash
# Start all services
docker compose up -d

# Check all services are healthy
docker compose ps

# Monitor logs
docker compose logs -f
```

### 5. SSL/TLS Setup (Production)

For production deployment, configure SSL:

```bash
# Update docker-compose.yml to include nginx proxy
# Add SSL certificates to nginx configuration
# Update CORS_ORIGINS in backend environment
```

## Verification and Testing

### 1. Health Check

Verify all services are running:

```bash
# Backend health
curl http://localhost:3001/health

# Frontend
curl http://localhost:3000

# Database connectivity
docker compose exec backend pnpm prisma:migrate status
```

### 2. Contract Interaction Testing

Test basic contract functionality:

```bash
cd contracts

# Test Registry registration
cast send <REGISTRY_ADDRESS> "register()" \
  --rpc-url https://sepolia.base.org \
  --private-key $TEST_PRIVATE_KEY

# Test SavingsVault deposit (requires token approval first)
cast send <TOKEN_ADDRESS> "approve(address,uint256)" \
  <SAVINGS_VAULT_ADDRESS> 1000000000000000000 \
  --rpc-url https://sepolia.base.org \
  --private-key $TEST_PRIVATE_KEY

cast send <SAVINGS_VAULT_ADDRESS> "deposit(uint256)" \
  1000000000000000000 \
  --rpc-url https://sepolia.base.org \
  --private-key $TEST_PRIVATE_KEY
```

### 3. End-to-End Testing

Test the full application flow:

1. Visit the frontend URL
2. Connect a wallet
3. Register an account
4. Make a test deposit
5. Create a savings goal
6. Join a community circle
7. Complete an education module
8. Interact with the AI assistant

### 4. Performance Testing

Monitor system performance:

```bash
# Check resource usage
docker stats

# Monitor database connections
docker compose exec postgres psql -U bfn_user -d bfn_production -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis memory usage
docker compose exec redis redis-cli info memory
```

## Post-Deployment Configuration

### 1. Event Indexer Verification

Ensure the event indexer is working:

```bash
# Check indexer logs
docker compose logs -f backend | grep -i "indexer"

# Verify events are being cached
docker compose exec backend psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"CachedEvent\";"
```

### 2. AI Assistant Configuration

Test AI assistant functionality:

```bash
# Make a test request
curl -X POST http://localhost:3001/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"question": "How can I save money effectively?"}'
```

### 3. IPFS Configuration

Verify IPFS document upload:

```bash
# Test document upload
curl -X POST http://localhost:3001/ipfs/profile-docs \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "files=@test-document.pdf"
```

### 4. Certificate Issuance

Test education certificate issuance:

```bash
# Complete a course and request certificate
curl -X POST http://localhost:3001/education/courses/test-course/certificate \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Monitoring and Maintenance

### 1. Log Management

Configure log aggregation:

```bash
# View logs
docker compose logs -f --tail=100

# Log rotation (add to crontab)
echo "0 0 * * * docker system prune -f" | crontab -
```

### 2. Database Maintenance

Regular maintenance tasks:

```bash
# Backup database
docker compose exec postgres pg_dump -U bfn_user bfn_production > backup.sql

# Vacuum database (weekly)
docker compose exec postgres psql -U bfn_user -d bfn_production -c "VACUUM ANALYZE;"
```

### 3. Security Updates

Keep system updated:

```bash
# Update container images
docker compose pull
docker compose up -d

# Update dependencies
pnpm update --recursive
```

### 4. Monitoring Setup

Configure monitoring tools:

- **Application Performance**: Set up APM monitoring
- **Uptime Monitoring**: Monitor service availability
- **Blockchain Monitoring**: Monitor contract events and gas usage
- **Database Monitoring**: Monitor connection pools and query performance

## Troubleshooting

### Common Issues

#### 1. Contract Deployment Failures

```bash
# Check gas estimation
forge estimate --rpc-url https://sepolia.base.org <CONTRACT_NAME>

# Increase gas limit if needed
forge script script/Deploy.s.sol:Deploy --gas-limit 3000000

# Verify RPC connectivity
cast chain-id --rpc-url https://sepolia.base.org
```

#### 2. Database Connection Issues

```bash
# Check connection string
docker compose exec backend node -e "console.log(process.env.DATABASE_URL)"

# Test direct connection
docker compose exec postgres psql $DATABASE_URL -c "SELECT NOW();"

# Reset connections
docker compose restart postgres backend
```

#### 3. Frontend Wallet Connection

- Ensure MetaMask is configured for Base Sepolia
- Check CORS configuration in backend
- Verify contract addresses are deployed (not zero addresses)

#### 4. Event Indexer Delays

```bash
# Check indexer status
docker compose logs backend | grep "Event_Indexer"

# Verify RPC connectivity
curl -X POST https://sepolia.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Restart indexer
docker compose restart backend
```

### Emergency Procedures

#### 1. Contract Pause

If issues are detected, pause contracts:

```bash
# Pause SavingsVault
cast send <SAVINGS_VAULT_ADDRESS> "pause()" \
  --rpc-url https://sepolia.base.org \
  --private-key $ADMIN_PRIVATE_KEY

# Pause CommunityTreasury
cast send <COMMUNITY_TREASURY_ADDRESS> "pause()" \
  --rpc-url https://sepolia.base.org \
  --private-key $ADMIN_PRIVATE_KEY
```

#### 2. Service Rollback

Rollback to previous version:

```bash
# Stop current services
docker compose down

# Pull previous image version
docker image tag bonitah-backend:latest bonitah-backend:rollback
docker image tag bonitah-backend:previous bonitah-backend:latest

# Restart services
docker compose up -d
```

#### 3. Database Recovery

Restore from backup:

```bash
# Stop services
docker compose stop backend

# Restore database
docker compose exec postgres psql -U bfn_user -d bfn_production < backup.sql

# Restart services
docker compose start backend
```

### Support Contacts

For additional support:
- **Smart Contracts**: Review contract documentation and events on Basescan
- **Backend Issues**: Check logs and health endpoints
- **Frontend Issues**: Verify network configuration and contract addresses
- **Database Issues**: Monitor connection pools and query performance

---

**Note**: This deployment guide assumes a production environment. For development deployment, see the main [README.md](../README.md) for simplified local setup instructions.