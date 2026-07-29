# Bonitah Financial Network (BFN)

A decentralized financial inclusion platform built on Base Sepolia, combining blockchain-backed savings, community treasury pools, education-linked reputation, and AI-powered financial guidance.

---

## Live Deployment

| Service | URL |
|---------|-----|
| Frontend | https://bonitah-f-n.netlify.app |
| Backend API | https://nbgicdhybbrbxbhfxsvi.supabase.co/functions/v1/backend |
| Blockchain | Base Sepolia (Chain ID: 84532) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                     │
│  Netlify Static Export · Wagmi · RainbowKit · TanStack Query │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
┌──────────────────┐ ┌─────────────┐ ┌──────────────┐
│  Base Sepolia     │ │  Supabase   │ │   Pinata     │
│  Smart Contracts  │ │  Edge Fn    │ │   IPFS       │
│  (UUPS Proxies)   │ │  (Backend)  │ │              │
└──────────────────┘ └─────────────┘ └──────────────┘
```

---

## Smart Contracts (Base Sepolia)

All contracts use the UUPS upgradeable proxy pattern with role-based access control.

| Contract | Address | Purpose |
|----------|---------|---------|
| Registry | `0xBd81a62b21eaE93D74daB2B2D93e040D51f75db1` | User registration, verification, reputation scores, IPFS profile hashes |
| SavingsVault | `0x16E88B4a717B082f8d29C4EeA0796F488C0da7B6` | USDC deposits, withdrawals, savings goals, time-locked savings |
| CommunityTreasury | `0xa0D284d9080cb7F6676e62116E0A659BB4Ed9b04` | Community investment circles and pooled savings |
| Education | `0x5A63Da81A04BE39d5469B8BD9281CbD3332b51ac` | Course certificates, achievements, reputation rewards |
| Governance | `0x13B14D148E3369dCC448006494810A95928eEEB4` | Proposals, reputation-weighted voting |
| USDC (Test) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | Base Sepolia USDC token |

### Key Contract Functions

**Registry**
- `register()` — Register a new user
- `updateProfile(string ipfsHash)` — Update profile metadata
- `reputationOf(address)` → `uint256` — Read reputation score
- `isRegistered(address)` → `bool`
- `verifyUser(address)` — Admin: verify a user

**SavingsVault**
- `deposit(uint256 amount)` — Deposit USDC
- `withdraw(uint256 amount)` — Withdraw available balance
- `balanceOf(address)` → `uint256` — Total portfolio value
- `createGoal(string name, uint256 target, uint256 deadline)`
- `lockFunds(uint256 amount, uint256 unlockTime)`

**Governance**
- `createProposal(string description, uint256 duration)`
- `vote(uint256 proposalId, bool support)` — Reputation-weighted voting
- `executeProposal(uint256 proposalId)`

---

## Backend (Supabase Edge Function)

Single Deno edge function handling all API routes. Authentication uses SIWE (Sign-In With Ethereum).

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service status and contract addresses |
| POST | `/auth/nonce` | Generate signing nonce |
| POST | `/auth/verify` | Verify SIWE signature, return JWT |
| GET | `/auth/me` | Current authenticated user |
| POST | `/ai/chat` | AI financial assistant (Ollama/DeepSeek) |
| GET | `/ai/provider` | Available AI providers |
| GET | `/chain?contract=&function=&args=` | On-chain contract reads |
| GET | `/analytics/portfolio?address=` | Portfolio analytics |
| GET | `/transactions?address=` | Transaction history |
| GET | `/education/courses` | Available courses |
| POST | `/ipfs/profile-metadata` | Upload JSON metadata to IPFS |
| POST | `/ipfs/profile-docs` | Upload files to IPFS |
| GET | `/ipfs/:hash` | Fetch content from IPFS |

### Authentication Flow
1. Frontend requests nonce: `POST /auth/nonce { address }`
2. User signs SIWE message with their wallet
3. Frontend submits: `POST /auth/verify { message, signature }`
4. Backend verifies signature, returns JWT (24h expiry)
5. All subsequent requests include `Authorization: Bearer <jwt>`

---

## Frontend (Next.js)

Static export deployed on Netlify. Client-side rendering with wallet integration.

### Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/auth` | Wallet connection and SIWE authentication |
| `/dashboard` | Portfolio overview, charts, recent transactions |
| `/savings` | Deposit/withdraw USDC, savings goals, locked funds |
| `/profile` | Profile management, documents, reputation, verification |
| `/community` | Community treasury and investment circles |
| `/ai` | AI financial assistant chat |
| `/settings` | App preferences and configuration |
| `/admin` | Admin panel for user verification |

### Tech Stack
- **Framework**: Next.js 14 (App Router, static export)
- **Wallet**: Wagmi v2 + RainbowKit (WalletConnect, Coinbase, MetaMask)
- **State**: TanStack Query for server/contract state
- **UI**: Tailwind CSS + shadcn/ui components
- **Chain**: viem for contract interactions
- **Hosting**: Netlify (static)

---

## Project Structure

```
Bonitah/
├── contracts/          # Foundry project - Solidity smart contracts
│   ├── src/            # Contract source (Registry, SavingsVault, etc.)
│   ├── test/           # Foundry tests
│   └── script/         # Deployment scripts
├── frontend/           # Next.js frontend application
│   ├── src/app/        # App Router pages
│   ├── src/components/ # React components (ui, dashboard, profile)
│   ├── src/hooks/      # Custom hooks (auth, contract reads, uploads)
│   └── src/lib/        # Shared utilities and contract config
├── backend/            # NestJS backend (local dev) + Supabase edge function
│   ├── src/            # NestJS modules (auth, ai, chain-read, etc.)
│   └── prisma/         # Database schema
├── supabase/           # Supabase edge functions (production backend)
│   └── functions/backend/index.ts
├── docs/               # API and contract documentation
└── .github/workflows/  # CI pipeline
```

---

## Development

### Prerequisites
- Node.js 20+
- pnpm
- Foundry (for contract development)

### Setup

```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Run frontend locally
cd frontend && npm run dev

# Run backend locally
cd backend && npm run start:dev

# Run contract tests
cd contracts && forge test
```

### Environment Variables

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_URL=https://nbgicdhybbrbxbhfxsvi.supabase.co/functions/v1/backend
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<project_id>
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_REGISTRY_ADDRESS=0xBd81a62b21eaE93D74daB2B2D93e040D51f75db1
NEXT_PUBLIC_SAVINGS_VAULT_ADDRESS=0x16E88B4a717B082f8d29C4EeA0796F488C0da7B6
NEXT_PUBLIC_COMMUNITY_TREASURY_ADDRESS=0xa0D284d9080cb7F6676e62116E0A659BB4Ed9b04
NEXT_PUBLIC_EDUCATION_ADDRESS=0x5A63Da81A04BE39d5469B8BD9281CbD3332b51ac
NEXT_PUBLIC_GOVERNANCE_ADDRESS=0x13B14D148E3369dCC448006494810A95928eEEB4
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

**Backend** (Supabase secrets):
```
JWT_SECRET=<secret>
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PINATA_JWT=<pinata_jwt>
OLLAMA_API_KEY=<ollama_key>
DEEPSEEK_API_KEY=<deepseek_key>
```

---

## Deployment

### Frontend (Netlify)
- Static export (`output: 'export'` in next.config.mjs)
- Auto-deploys from `main` branch or via `netlify deploy --prod --dir=out`
- No server-side rendering — all client-side

### Backend (Supabase Edge Functions)
- Single Deno edge function at `supabase/functions/backend/index.ts`
- Deploy: `supabase functions deploy backend`
- Secrets managed via Supabase dashboard

### Contracts (Foundry)
- UUPS proxy pattern — upgradeable without redeployment
- Deploy: `forge script script/Deploy.s.sol --rpc-url base-sepolia --broadcast`
- Verify: `forge verify-contract <address> <contract> --chain base-sepolia`

---

## Security

- **Authentication**: SIWE (EIP-4361) — wallet-based, no passwords
- **Authorization**: Role-based access control on all contracts
- **Upgradability**: UUPS proxy with `UPGRADER_ROLE` restriction
- **IPFS**: Profile metadata and documents stored on Pinata
- **Pre-commit**: Secret scanning + ESLint/Prettier via Husky hooks
- **No PII**: Documents are user-controlled; no SSN/passport storage

---

## License

Private — All rights reserved.
