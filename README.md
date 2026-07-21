# Bonitah Financial Network (BFN)

A production-quality Web3 monorepo for financial education, decentralized savings, and
community investing on the Base Sepolia network (chain ID `84532`). The blockchain is the
single source of truth for all financial state.

## Monorepo structure

| Directory            | Purpose                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- |
| `contracts/`         | Foundry project: Registry, SavingsVault, CommunityTreasury, Education, Governance. |
| `frontend/`          | Next.js app (App Router, TypeScript, Tailwind, wagmi/viem/RainbowKit).             |
| `backend/`           | NestJS API, SIWE auth, event indexer, AI assistant, IPFS service.                  |
| `shared/`            | Shared TypeScript types, ABIs, contract addresses, and zod schemas.                |
| `docs/`              | README, API docs, contract docs, deployment and developer guides.                  |
| `docker/`            | Dockerfiles and `docker-compose.yml`.                                              |
| `.github/workflows/` | CI workflows (lint, test, build).                                                  |
| `scripts/`           | Tooling, codegen, secret scanning, coverage aggregation.                           |
| `deployment/`        | Base Sepolia deployment scripts and recorded contract addresses.                   |
| `tests/`             | Cross-cutting and end-to-end test suites.                                          |

## Prerequisites

- Node.js `>=20`
- pnpm `>=9`

## Workspace scripts

Run from the repository root:

```bash
pnpm install        # install workspace dependencies
pnpm lint           # ESLint + Prettier check across the monorepo
pnpm lint:fix       # auto-fix lint and formatting issues
pnpm format         # write Prettier formatting
pnpm typecheck      # type-check all workspace packages
pnpm test           # run tests across all workspace packages
pnpm build          # build all workspace packages
```

Workspace packages are defined in `pnpm-workspace.yaml`. The strict TypeScript base
configuration lives in `tsconfig.base.json` and is extended by each package.
