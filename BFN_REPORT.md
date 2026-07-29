# Bonitah Financial Network (BFN) — Full Project Report

**Date**: July 29, 2026  
**Version**: 0.1.0  
**Status**: Live on Base Sepolia Testnet  
**Repository**: github.com/hassanmubiru/Bonitah

---

## 1. Executive Summary

Bonitah Financial Network (BFN) is a production-quality Web3 platform for **financial education**, **decentralized savings**, and **community investing** deployed on Base Sepolia (Layer 2). The platform enables unbanked and underbanked users to:

- Save in USDC with on-chain savings goals and time-locked deposits
- Participate in community investment circles with threshold-based governance
- Earn reputation through education, achievements, and participation
- Access AI-powered financial guidance
- Store identity and credentials on IPFS

The system is fully operational with 6 deployed smart contracts, a Supabase edge function backend, and a Netlify-hosted frontend.

---

## 2. Live Deployment

| Component | URL / Address | Status |
|-----------|--------------|--------|
| Frontend | https://bonitah-f-n.netlify.app | ✅ Live |
| Backend API | https://nbgicdhybbrbxbhfxsvi.supabase.co/functions/v1/backend | ✅ Live |
| Registry | `0xBd81a62b21eaE93D74daB2B2D93e040D51f75db1` | ✅ Deployed |
| SavingsVault | `0x16E88B4a717B082f8d29C4EeA0796F488C0da7B6` | ✅ Deployed |
| CommunityTreasury | `0xa0D284d9080cb7F6676e62116E0A659BB4Ed9b04` | ✅ Deployed |
| Education | `0x5A63Da81A04BE39d5469B8BD9281CbD3332b51ac` | ✅ Deployed |
| Governance | `0x13B14D148E3369dCC448006494810A95928eEEB4` | ✅ Deployed |
| USDC (Test) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | ✅ Deployed |
| Chain | Base Sepolia (ID: 84532) | ✅ Active |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 14)                          │
│  Static Export · Wagmi v2 · RainbowKit · TanStack Query · Tailwind│
│  Hosted on Netlify                                                │
└────────────────────────────┬─────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│  Base Sepolia     │  │  Supabase    │  │   Pinata     │
│  Contracts        │  │  Edge Fn     │  │   IPFS       │
│  (6 UUPS Proxies) │  │  (Deno)      │  │              │
│                   │  │              │  │              │
│  Registry         │  │  Auth (SIWE) │  │  Profiles    │
│  SavingsVault     │  │  AI Chat     │  │  Documents   │
│  CommunityTreasury│  │  Chain Read  │  │  Certificates│
│  Education        │  │  Analytics   │  │              │
│  Governance       │  │  IPFS Proxy  │  │              │
│  EducationContent │  │  Transactions│  │              │
└──────────────────┘  └──────────────┘  └──────────────┘
```

---

## 4. Smart Contracts

### 4.1 Overview

All contracts are written in Solidity 0.8.24, compiled with Foundry (optimizer: 200 runs, via-ir), and deployed behind UUPS upgradeable proxies with OpenZeppelin AccessControl.

### 4.2 Role System (BFNRoles)

| Role | Purpose | Granted To |
|------|---------|------------|
| DEFAULT_ADMIN_ROLE | Grant/revoke all roles | Deployer |
| PAUSER_ROLE | Pause/unpause value transfers | Admin |
| VERIFIER_ROLE | Verify user identity | Admin |
| UPGRADER_ROLE | Authorize proxy upgrades | Admin |
| TREASURY_ROLE | Execute treasury operations | Governance |
| REPUTATION_ROLE | Increase reputation scores | Education contract |
| ISSUER_ROLE | Issue certificates/badges | Backend service |

### 4.3 Registry

**Purpose**: User identity — registration, IPFS profiles, verification, reputation.

| Function | Access | Description |
|----------|--------|-------------|
| `register()` | Public | Register new user (one-time) |
| `updateProfile(string ipfsHash)` | Registered users | Set IPFS profile metadata hash |
| `verifyUser(address)` | VERIFIER_ROLE | Mark user as verified |
| `increaseReputation(address, uint256)` | REPUTATION_ROLE | Add reputation points |
| `isRegistered(address)` → bool | View | Check registration |
| `reputationOf(address)` → uint256 | View | Read reputation score |
| `getProfile(address)` → UserProfile | View | Full profile struct |

**Events**: UserRegistered, ProfileUpdated, UserVerified, ReputationIncreased

### 4.4 SavingsVault

**Purpose**: Personal savings with goals and time-locks. Holds USDC (ERC20).

| Function | Access | Description |
|----------|--------|-------------|
| `deposit(uint256)` | Registered, !Paused | Deposit USDC into vault |
| `withdraw(uint256)` | Registered, !Paused | Withdraw available balance |
| `createGoal(uint256 target, uint256 date)` | Registered | Create savings goal |
| `contributeToGoal(uint256 goalId, uint256 amount)` | Registered | Fund a goal |
| `lockFunds(uint256 amount, uint256 duration)` | Registered | Time-lock funds (1d–5yr) |
| `withdrawLocked(uint256 lockId)` | Registered | Withdraw after lock expires |
| `availableBalance(address)` → uint256 | View | Balance minus locked |
| `portfolioValue(address)` → uint256 | View | Total including goals |

**Security**: ReentrancyGuard, SafeERC20, Pausable, registration gate.

**Events**: DepositMade, WithdrawalMade, GoalCreated, GoalCompleted, FundsLocked, LockReleased

### 4.5 CommunityTreasury

**Purpose**: Community savings circles with multi-sig-style voting and investment pools.

| Function | Access | Description |
|----------|--------|-------------|
| `createCircle(uint256 maxMembers, uint8 threshold)` | Public | Create circle (2–1000 members) |
| `joinCircle(uint256 poolId)` | Public | Join open circle |
| `contribute(uint256 poolId, uint256 amount)` | Members | Add USDC to circle |
| `proposeAction(uint256 poolId, address to, uint256 amount)` | Members | Propose disbursement |
| `vote(uint256 actionId)` | Members | Vote; auto-executes at threshold |
| `contributeToPool(uint256 poolId, uint256 amount)` | Members | Investment pool contribution |
| `ownershipShare(uint256, address)` → uint256 | View | Share in parts-per-million |
| `yieldDistribution(uint256, address, uint256)` → uint256 | View | Proportional yield |

**Events**: PoolCreated, MemberJoined, ContributionMade, VoteCast, ActionExecuted

### 4.6 Education

**Purpose**: On-chain credentials — certificates, badges, achievements with reputation rewards.

| Function | Access | Description |
|----------|--------|-------------|
| `issueCertificate(address, bytes32, string)` | ISSUER_ROLE | Issue course certificate |
| `awardBadge(address, bytes32)` | ISSUER_ROLE | Award achievement badge |
| `recordAchievement(address, bytes32, uint256)` | ISSUER_ROLE | Record + give reputation |
| `hasCertificate(address, bytes32)` → bool | View | Check certificate |
| `hasBadge(address, bytes32)` → bool | View | Check badge |

**Cross-contract**: Calls `Registry.increaseReputation()` on achievements.

### 4.7 EducationContent

**Purpose**: On-chain course management with lessons and streak tracking.

| Function | Access | Description |
|----------|--------|-------------|
| `createCourse(title, desc, ipfsHash)` | ISSUER_ROLE | Create course |
| `addLesson(courseId, title, ipfsHash)` | ISSUER_ROLE | Add lesson to course |
| `completeLesson(courseId, lessonId)` | Registered | Mark lesson done |
| `getUserProgress(address, courseId)` | View | Completion stats |
| `getUserStreak(address)` | View | Current/longest streak |

### 4.8 Governance

**Purpose**: Reputation-weighted voting on proposals.

| Function | Access | Description |
|----------|--------|-------------|
| `propose(bytes action, uint256 period)` | Rep > 0 | Create proposal |
| `castVote(uint256 proposalId, bool support)` | Rep > 0 | Vote (weight = reputation) |
| `finalize(uint256 proposalId)` | Public | Determine outcome after voting ends |
| `executeTreasury(bytes action)` | TREASURY_ROLE | Execute approved actions |
| `votingPowerOf(address)` → uint256 | View | User's voting weight |

**Outcome**: Passes if ≥51% for-votes with quorum met; otherwise rejected.

### 4.9 EventIndexer

**Purpose**: On-chain event storage for transaction history queries.

| Function | Access | Description |
|----------|--------|-------------|
| `indexEvent(...)` | ADMIN | Store blockchain event |
| `getUserEvents(address, offset, limit)` | View | Paginated user events |
| `getUserTransactions(address, offset, limit)` | View | Transaction summaries |
| `getUserFinancialSummary(address)` | View | Deposits/withdrawals totals |

---

## 5. Backend API

**Runtime**: Supabase Edge Function (Deno)  
**Auth**: SIWE (Sign-In With Ethereum) → JWT (24h expiry)  
**AI Providers**: Ollama Cloud, DeepSeek, OpenAI (priority fallback chain)  
**Storage**: Pinata (IPFS), Supabase PostgreSQL  

### 5.1 Endpoints

| Category | Method | Path | Description |
|----------|--------|------|-------------|
| Health | GET | /health | Service status, contract addresses, AI config |
| Auth | POST | /auth/nonce | Generate SIWE signing nonce |
| Auth | POST | /auth/verify | Verify signature, issue JWT |
| Auth | GET | /auth/me | Current user from token |
| AI | POST | /ai/chat | Financial assistant (multi-provider) |
| AI | GET | /ai/provider | Available/configured providers |
| AI | GET | /ai/conversations | Conversation history |
| Chain | GET | /chain?contract=&function=&args= | On-chain reads with provenance |
| Analytics | GET | /analytics/portfolio?address= | Portfolio time series |
| Transactions | GET | /transactions?address= | Transaction history |
| Education | GET | /education/courses | Available courses |
| IPFS | POST | /ipfs/profile-metadata | Upload JSON to Pinata |
| IPFS | POST | /ipfs/profile-docs | Upload files to Pinata |
| IPFS | GET | /ipfs/:hash | Fetch from IPFS gateway |

### 5.2 Authentication Flow

1. `POST /auth/nonce { address }` → returns nonce (5min TTL)
2. User signs SIWE message with wallet
3. `POST /auth/verify { message, signature }` → verifies via `recoverMessageAddress`, returns JWT
4. All subsequent requests: `Authorization: Bearer <jwt>`

---

## 6. Frontend

**Framework**: Next.js 14 (App Router, static export)  
**Hosting**: Netlify  
**Wallet**: Wagmi v2 + RainbowKit (MetaMask, Coinbase, WalletConnect)  
**State**: TanStack Query (60s stale, 10min GC, no auto-refetch)  
**UI**: Tailwind CSS + shadcn/ui + Framer Motion  

### 6.1 Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with product overview |
| `/auth` | Wallet connection + SIWE authentication |
| `/dashboard` | Portfolio overview, charts (recharts), recent transactions |
| `/savings` | Deposit/withdraw USDC, create goals, lock funds |
| `/profile` | Profile management, IPFS documents, reputation, verification |
| `/community` | Investment circles, pooled savings, voting |
| `/ai` | AI financial assistant chat interface |
| `/settings` | Theme, notifications, preferences |
| `/admin` | User verification, system management |

### 6.2 Key Hooks

| Hook | Purpose |
|------|---------|
| `useSiweAuth` | SIWE sign-in flow, JWT management |
| `useContractRead` | Generic contract reads with retry/timeout |
| `useRegistryProfile` | Profile data from Registry + IPFS |
| `useDocumentUpload` | File upload to IPFS via Pinata |
| `usePortfolioValue` | SavingsVault portfolio reads |
| `useReputationScore` | Registry reputation via `reputationOf` |
| `useAuthGuard` | Authentication state management |

### 6.3 Component Library

- **UI**: 20+ shadcn/ui components (Card, Button, Badge, Alert, Tabs, Progress, etc.)
- **Dashboard**: PortfolioOverview, PortfolioChart, RecentTransactions
- **Profile**: ProfileView, ProfileEditor, ProfileDocuments, ReputationDisplay
- **Auth**: WalletConnect modal, network guard

---

## 7. Infrastructure & DevOps

### 7.1 Monorepo Structure

```
Bonitah/
├── contracts/        Foundry (Solidity 0.8.24, 30+ test files)
├── frontend/         Next.js 14 (static export)
├── backend/          NestJS (local dev) + Prisma + Jest
├── supabase/         Edge function (production backend)
├── shared/           Cross-package types and config
├── tests/            Integration/E2E tests
└── docs/             API + Contract documentation
```

**Package Manager**: pnpm 9 (workspace protocol)  
**Node**: ≥20  

### 7.2 CI/CD Pipeline (GitHub Actions)

| Job | Trigger | Actions |
|-----|---------|---------|
| Lint & Typecheck | Push/PR to main/develop | ESLint, TypeScript, Prettier |
| Tests | After lint | Matrix: backend (Jest), frontend (Jest), contracts (Forge) |
| Build | After tests pass | Build frontend + backend artifacts |
| Security | After lint | pnpm audit + TruffleHog secret scanning |
| E2E | Main/develop only | Playwright browser tests |

### 7.3 Code Quality

- **Pre-commit**: Secret scanning + lint-staged (ESLint --fix, Prettier)
- **Commit format**: Conventional commits via commitlint
- **Linting**: ESLint 9 + typescript-eslint + Prettier
- **Type safety**: Strict TypeScript across all packages

### 7.4 Deployment Pipeline

| Component | Method | Trigger |
|-----------|--------|---------|
| Frontend | `netlify deploy --prod --dir=out` | Manual / Git push |
| Backend | `supabase functions deploy backend` | Manual |
| Contracts | `forge script --broadcast --verify` | Manual |

---

## 8. Security Model

### 8.1 Authentication
- **SIWE (EIP-4361)**: Wallet-based, no passwords or emails
- **JWT**: HS256 signed, 24h expiry, stored in localStorage
- **Nonce**: UUID with 5-minute TTL, single-use

### 8.2 Smart Contract Security
- **UUPS Proxy**: Upgradeable with UPGRADER_ROLE restriction
- **ReentrancyGuard**: On all value-transfer functions
- **SafeERC20**: For all token movements
- **Pausable**: Emergency stop on deposits/withdrawals
- **Role-based access**: Least-privilege principle
- **Input validation**: Zero-amount checks, address validation, time bounds

### 8.3 Frontend Security
- **CSP Headers**: X-Frame-Options DENY, X-Content-Type-Options nosniff
- **CORS**: Cross-Origin-Opener-Policy same-origin-allow-popups
- **No PII storage**: Documents are user-controlled on IPFS

### 8.4 Secret Management
- Pre-commit secret scanning blocks accidental secret commits
- Supabase secrets for backend API keys
- Environment variables for frontend (NEXT_PUBLIC_ prefix only)

---

## 9. Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Blockchain | Base Sepolia (Ethereum L2) | Chain ID 84532 |
| Smart Contracts | Solidity + OpenZeppelin | 0.8.24 |
| Contract Tooling | Foundry (forge, cast) | Latest |
| Backend Runtime | Deno (Supabase Edge) | Latest |
| Backend Framework | NestJS (local dev) | 10.x |
| Frontend Framework | Next.js (App Router) | 14.2 |
| Wallet SDK | Wagmi + RainbowKit | 2.x |
| Blockchain Client | viem | 2.21+ |
| UI | Tailwind + shadcn/ui | 3.4 / Latest |
| State Management | TanStack Query | 5.x |
| Database | Prisma + PostgreSQL | 6.x |
| File Storage | Pinata (IPFS) | — |
| AI | Ollama / DeepSeek / OpenAI | — |
| Hosting (Frontend) | Netlify | — |
| Hosting (Backend) | Supabase | — |
| CI/CD | GitHub Actions | — |
| Package Manager | pnpm | 9.x |

---

## 10. Current Status & Known Limitations

### Working
- ✅ Wallet connection and SIWE authentication
- ✅ On-chain contract reads (balances, reputation, registration)
- ✅ IPFS document upload via Pinata
- ✅ AI chat with Ollama/DeepSeek fallback
- ✅ All smart contracts deployed and verified
- ✅ Static frontend deployed on Netlify
- ✅ Backend health and auth endpoints operational

### Limitations
- Analytics and transaction history use mock data (pending event indexer integration)
- Education courses are placeholder data in backend (on-chain EducationContent ready)
- Governance UI exists but proposals require reputation > 0 to create
- No mainnet deployment yet (testnet only)
- JWT verification is simplified (no HMAC verification on decode)

---

## 11. Repository Statistics

| Metric | Value |
|--------|-------|
| Smart Contracts | 9 Solidity files |
| Contract Tests | 30+ test files (unit, integration, property, gas) |
| Frontend Pages | 9 routes |
| Custom Hooks | 15+ |
| UI Components | 20+ (shadcn/ui based) |
| Backend Endpoints | 14 API routes |
| CI Jobs | 5 (lint, test, build, security, e2e) |
| Total Commits | 1000+ |

---

*Report generated: July 29, 2026*
