# Implementation Plan: Bonitah Financial Network (BFN)

## Overview

This plan converts the BFN design into an incremental, test-driven sequence of coding tasks across the monorepo: Foundry smart contracts, the shared package, the NestJS backend, the Next.js frontend, DevOps tooling, and documentation. Each task builds on prior tasks and ends by wiring new code into the running system so no code is left orphaned.

The blockchain is the single source of truth: contracts hold all financial state, the frontend reads values directly on-chain, and the backend stores only off-chain data plus a provenanced cache. Property-based tests (minimum 100 iterations, tagged with their design property number) validate the universal correctness properties; unit/integration/e2e tests cover examples, edge cases, and smoke items.

Languages are fixed by the design: Solidity ^0.8.24 (Foundry) for contracts, TypeScript (strict) for the shared package, backend (NestJS), and frontend (Next.js). Contract property tests use Foundry fuzz/invariant runs; backend/frontend property tests use `fast-check`.

## Tasks

- [x] 1. Establish monorepo structure and shared package
  - [x] 1.1 Initialize the monorepo workspace and top-level directories
    - Create the workspace package manager config and the exact top-level directories: `contracts/`, `frontend/`, `backend/`, `shared/`, `docs/`, `docker/`, `.github/workflows/`, `scripts/`, `deployment/`, `tests/`
    - Add root strict TypeScript base config, ESLint + Prettier config, and workspace scripts (lint, test, build)
    - _Requirements: 17.1, 17.2, 17.3_

  - [x] 1.2 Build the shared package (types, schemas, address registry)
    - Define shared TypeScript types, per-network deployed-address registry (Base Sepolia 84532), and zod schemas for API request/response contracts
    - Set up `abitype`/viem-based ABI typing placeholders to be populated after contract build
    - _Requirements: 17.1, 1.1, 14.3_

  - [x] 1.3 Write unit tests for shared zod schemas
    - Test schema acceptance/rejection for representative valid and invalid payloads
    - _Requirements: 14.3, 14.4_

- [x] 2. Set up the Foundry contracts project and shared contract primitives
  - [x] 2.1 Initialize the Foundry project and cross-cutting base
    - Create `foundry.toml` with `fuzz.runs >= 100` and invariant runs; install OpenZeppelin upgradeable contracts
    - Implement a shared roles/errors base library (DEFAULT_ADMIN, PAUSER, VERIFIER, UPGRADER, TREASURY, REPUTATION, ISSUER roles) and UUPS scaffolding
    - _Requirements: 14.5, 14.6, 14.8, 9.8_

  - [x] 2.2 Define contract interfaces and a mock ERC20 test token
    - Add `IRegistry`, `ISavingsVault`, `ICommunityTreasury`, `IEducation`, `IGovernance` interfaces with events and custom errors
    - Implement a mock ERC20 stablecoin for tests and configurable token wiring
    - _Requirements: 4.5, 13.1, 13.2, 13.6, 13.9_

- [x] 3. Implement the Registry contract
  - [x] 3.1 Implement `Registry.sol`
    - Implement `register`, `updateProfile`, `verifyUser` (VERIFIER_ROLE), `increaseReputation` (REPUTATION_ROLE), views, custom errors, events, and UUPS `_authorizeUpgrade`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.10, 8.7, 13.1, 14.5, 14.8_

  - [x] 3.2 Write property test for registration lifecycle
    - **Property 7: Registration initializes state and is not repeatable**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 3.3 Write property test for profile update round-trip
    - **Property 8: Profile update round-trip for registered users only**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 3.4 Write property test for reputation invariant
    - **Property 9: Reputation is a monotonic non-negative integer**
    - **Validates: Requirements 3.7, 8.7**

  - [x] 3.5 Write unit, event-emission, and revert tests for Registry
    - Assert `UserRegistered`/`ProfileUpdated`/`UserVerified` args and one revert test per custom error
    - _Requirements: 13.1, 15.1, 15.2, 15.3_

- [x] 4. Implement the SavingsVault contract
  - [x] 4.1 Implement deposit/withdraw core in `SavingsVault.sol`
    - Implement `deposit`, `withdraw`, `availableBalance` with `SafeERC20`, `ReentrancyGuard`, `Pausable`, registration checks, and events
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 13.2, 13.3_

  - [x] 4.2 Write property test for vault balance conservation
    - **Property 11: Vault balance conservation and portfolio value**
    - **Validates: Requirements 4.2, 4.3, 5.6**

  - [x] 4.3 Write property test for invalid vault operations
    - **Property 12: Invalid vault operations revert without state change**
    - **Validates: Requirements 4.4, 4.7, 4.8, 4.9**

  - [x] 4.4 Implement goals and locked savings in `SavingsVault.sol`
    - Implement `createGoal`, `contributeToGoal`, `lockFunds`, `withdrawLocked`, `portfolioValue`, MIN/MAX lock constants, and goal/lock events
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 13.4, 13.5_

  - [ ] 4.5 Write property test for goal lifecycle
    - **Property 13: Goal lifecycle correctness**
    - **Validates: Requirements 5.1, 5.2, 5.7**

  - [ ] 4.6 Write property test for locked savings time-lock
    - **Property 14: Locked savings time-lock round-trip**
    - **Validates: Requirements 5.3, 5.4, 5.5, 5.8**

  - [ ] 4.7 Write unit, event, revert, and reentrancy tests for SavingsVault
    - Assert deposit/withdraw/goal/lock event args, one revert test per custom error, and a reentrancy-attack test
    - _Requirements: 4.6, 13.2, 13.3, 13.4, 13.5, 15.1, 15.2, 15.3_

- [-] 5. Implement the CommunityTreasury contract
  - [x] 5.1 Implement savings circles in `CommunityTreasury.sol`
    - Implement `createCircle`, `joinCircle`, `contribute`, `proposeAction`, `vote`, threshold-based execution, per-member contribution history, `nonReentrant` on value moves, and events
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 13.6, 13.7, 13.8_

  - [x] 5.2 Write property test for circle creation and membership
    - **Property 15: Savings circle creation and membership rules**
    - **Validates: Requirements 6.1, 6.2, 6.9, 6.11**

  - [x] 5.3 Write property test for contributions and history
    - **Property 16: Circle contributions and per-member history**
    - **Validates: Requirements 6.3, 6.6, 6.5**

  - [x] 5.4 Write property test for treasury action threshold
    - **Property 17: Treasury action executes exactly at threshold**
    - **Validates: Requirements 6.7**

  - [x] 5.5 Implement investment pools in `CommunityTreasury.sol`
    - Implement `contributeToPool`, `ownershipShare` (ppm), `yieldDistribution`, and timestamped contribution history
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 13.7_

  - [ ] 5.6 Write property test for pool ownership and yield
    - **Property 19: Investment pool ownership share and yield are proportional and conserved**
    - **Validates: Requirements 7.1, 7.6**

  - [ ] 5.7 Write property test for pool contribution records
    - **Property 20: Pool contribution records amount and timestamp**
    - **Validates: Requirements 7.3**

  - [ ] 5.8 Write unit, event, revert, and reentrancy tests for CommunityTreasury
    - Assert `PoolCreated`/`ContributionMade`/`VoteCast`/`ActionExecuted` args, one revert test per custom error, and a reentrancy-attack test
    - _Requirements: 6.8, 13.6, 13.7, 13.8, 15.1, 15.2, 15.3_

- [x] 6. Implement the Education contract
  - [x] 6.1 Implement `Education.sol`
    - Implement `issueCertificate` (ISSUER_ROLE, non-empty hash, duplicate guard), `awardBadge`, `recordAchievement`, and `Registry.increaseReputation` wiring via REPUTATION_ROLE; emit events
    - _Requirements: 8.3, 8.4, 8.5, 8.7, 8.9, 8.10, 13.9, 14.5, 14.8_

  - [x] 6.2 Write property test for certificate and achievement proofs
    - **Property 22: Certificate and achievement proofs recorded once**
    - **Validates: Requirements 8.3, 8.5**

  - [x] 6.3 Write unit, event, and revert tests for Education
    - Assert `CertificateIssued`/`BadgeAwarded`/`AchievementRecorded` args and one revert test per custom error
    - _Requirements: 13.9, 15.1, 15.2, 15.3_

- [x] 7. Implement the Governance contract
  - [x] 7.1 Implement `Governance.sol`
    - Implement `propose`, `castVote` (weighted, active-only, no double vote), `finalize`, `outcomeOf`, `executeTreasury` (TREASURY_ROLE), `votingPowerOf`, UUPS upgrade, and events
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 13.8, 14.5, 14.8_

  - [x] 7.2 Write property test for proposal creation and weighted voting
    - **Property 23: Governance proposal and weighted voting correctness**
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [x] 7.3 Write property test for proposal outcome determination
    - **Property 24: Proposal outcome is determined by recorded votes**
    - **Validates: Requirements 9.4, 9.5, 9.6**

  - [x] 7.4 Write property test for upgrade state preservation
    - **Property 25: Upgrade preserves governance state**
    - **Validates: Requirements 9.8**

  - [x] 7.5 Write unit, event, and revert tests for Governance
    - Assert `ProposalCreated`/`VoteCast`/`ProposalFinalized` args and one revert test per custom error
    - _Requirements: 13.8, 15.1, 15.2, 15.3_

- [ ] 8. Cross-contract property tests and coverage
  - [ ] 8.1 Write property test for non-repeatable on-chain operations
    - **Property 18: Repeated operations are rejected while prior state is retained**
    - **Validates: Requirements 3.2, 6.10, 8.10, 9.9**

  - [ ] 8.2 Write property test for unauthorized privileged operations
    - **Property 26: Unauthorized privileged operations revert without state change**
    - **Validates: Requirements 3.10, 6.5, 9.7, 9.10, 14.5, 14.7, 14.9**

  - [ ] 8.3 Write property test for event emission discipline
    - **Property 33: Exactly one event per successful state change; none on revert**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10**

  - [ ] 8.4 Checkpoint - contracts test suite
    - Ensure all contract tests pass and coverage meets >=90% line/branch; ask the user if questions arise.

- [ ] 9. Deployment scripts and shared ABI/address emission
  - [ ] 9.1 Implement Foundry Base Sepolia deployment scripts
    - Deploy all five contracts behind UUPS proxies, wire roles, record deployed addresses to `deployment/` and `shared/`, and fail non-zero naming the failed contract with no partial-success report
    - _Requirements: 16.5, 16.6_

  - [ ] 9.2 Emit typed ABIs and addresses into the shared package
    - Generate ABI + address exports into `shared/` for frontend and backend consumption
    - _Requirements: 17.1, 1.1_

- [x] 10. Establish backend foundation (NestJS)
  - [x] 10.1 Initialize the NestJS app and cross-cutting infrastructure
    - Scaffold the app, env-var config with validation, structured JSON logging (request IDs, no secrets/PII), global `HttpExceptionFilter`, and `HealthModule` (DB/Redis/RPC checks)
    - _Requirements: 16.2, 16.7, 14.2_

  - [x] 10.2 Define the Prisma schema and migrations
    - Implement all models (`User`, `AuthNonce`, `Course`, `Lesson`, `LessonProgress`, `LearningStreak`, `CachedEvent`, `IndexerState`, `CachedReadValue`, `Conversation`, `Message`, `Notification`) and generate migrations
    - _Requirements: 1.3, 1.4, 2.7, 8.1, 8.2, 8.8, 10.4, 12.2, 12.6_

  - [x] 10.3 Implement global validation and auth guards
    - Wire `ZodValidationPipe`, `JwtAuthGuard`, and `RolesGuard` so non-public endpoints require a valid JWT and role checks
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 10.4 Write property test for backend input validation
    - **Property 34: Input schema validation rejects invalid input without mutation**
    - **Validates: Requirements 14.3, 14.4**

- [x] 11. Implement the Auth module (SIWE)
  - [x] 11.1 Implement SIWE nonce, verification, JWT, and roles
    - Implement `/auth/nonce`, `/auth/verify`, `/auth/logout`; single-use expiry-bounded nonces, signature/address verification, JWT issuance (<=24h), and least-privilege default role assignment
    - _Requirements: 2.4, 2.6, 2.7, 2.8, 2.9, 2.10, 10.6, 14.1_

  - [x] 11.2 Write property test for nonce single-use and expiry
    - **Property 4: SIWE nonces are single-use and expiry-bounded**
    - **Validates: Requirements 2.4, 2.6, 2.7, 2.8**

  - [x] 11.3 Write property test for session JWT acceptance
    - **Property 5: Sessions are accepted iff the JWT is valid and unexpired**
    - **Validates: Requirements 2.7, 2.9, 14.1, 14.2**

  - [x] 11.4 Write property test for least-privilege default role
    - **Property 6: New wallets default to least-privilege role**
    - **Validates: Requirements 2.10**

  - [x] 11.5 Write property test for unsigned transaction rejection
    - **Property 27: Unsigned transactions are rejected**
    - **Validates: Requirements 10.6**

  - [x] 11.6 Write integration tests for auth endpoints
    - Cover the nonce -> verify -> JWT flow and rejection paths (invalid signature, reused/expired nonce, expired JWT)
    - _Requirements: 2.5, 2.6, 2.8, 2.9_

- [x] 12. Implement the ChainRead read-through cache module
  - [x] 12.1 Implement provenanced read-through cache with staleness
    - Read financial values from Base Sepolia via viem, cache with `{contractAddress, blockNumber, fetchedAt}` and 30s TTL, refresh when stale/absent, and never serve stale/placeholder on read failure
    - _Requirements: 1.4, 1.5, 1.7, 7.5, 10.9, 11.1_

  - [x] 12.2 Write property test for cache provenance and staleness
    - **Property 1: Cached financial values carry provenance and honor 30s staleness**
    - **Validates: Requirements 1.4, 12.2**

  - [x] 12.3 Write property test for stale-read refresh behavior
    - **Property 2: Stale reads are refreshed from the source contract**
    - **Validates: Requirements 1.5**

  - [x] 12.4 Write unit/integration tests for read-failure handling
    - Assert timeout vs RPC vs decode errors surface as failures with no substituted value
    - _Requirements: 1.7, 10.9_

- [ ] 13. Implement the Event_Indexer module
  - [x] 13.1 Implement the indexer worker
    - Poll finalized head, `getLogs` from last+1, idempotent upsert on `(txHash, logIndex)` with provenance, reorg detection/repair, and gapless resume with backoff on network loss
    - _Requirements: 12.1, 12.2, 12.5, 12.6, 13.10_

  - [ ] 13.2 Write property test for reorg convergence
    - **Property 31: Event indexing converges to canonical chain state**
    - **Validates: Requirements 12.5**

  - [ ] 13.3 Write property test for gapless resume
    - **Property 32: Indexing resumes gaplessly**
    - **Validates: Requirements 12.6**

  - [ ] 13.4 Write integration test for 60s indexing timing
    - Verify a finalized event is cached with provenance within the required window
    - _Requirements: 12.1, 12.2_

- [ ] 14. Implement the Transactions and Analytics modules
  - [x] 14.1 Implement transaction history and analytics endpoints
    - Implement `/transactions` (own-wallet scope, descending block, <=100/page, empty set for none) and `/analytics/portfolio` provenanced series
    - _Requirements: 11.1, 12.3, 12.4_

  - [ ] 14.2 Write property test for transaction history scoping/ordering/paging
    - **Property 30: Transaction history is scoped, ordered, and paged**
    - **Validates: Requirements 11.2, 12.3**

  - [ ] 14.3 Write unit tests for empty and boundary pagination
    - Test empty result set and max-page-size behavior
    - _Requirements: 12.3, 12.4_

- [ ] 15. Implement the IPFS module
  - [x] 15.1 Implement the IPFS service
    - Accept <=10 docs/request at <=10MB each, validate/exclude PII fields, pin content, return CID on success, and return storage error with no CID on failure
    - _Requirements: 3.5, 3.8, 3.9, 8.4_

  - [ ] 15.2 Write property test for upload boundary and PII exclusion
    - **Property 10: IPFS upload boundary validation**
    - **Validates: Requirements 3.5, 3.8**

  - [ ] 15.3 Write unit tests for storage-failure handling
    - Assert failure returns an error and no CID
    - _Requirements: 3.9, 8.9_

- [ ] 16. Implement the Education and Certificate backend modules
  - [x] 16.1 Implement the Education module
    - Implement courses/lessons content, lesson-completion with dedupe, course progress, and consecutive-day learning streak in off-chain data
    - _Requirements: 8.1, 8.2, 8.6, 8.8_

  - [ ] 16.2 Write property test for the learning streak
    - **Property 21: Learning streak equals consecutive-day count**
    - **Validates: Requirements 8.2**

  - [ ] 16.3 Implement the Certificate orchestration module
    - Implement `/education/courses/:id/certificate`: verify completion, store metadata via IPFS, then call `Education.issueCertificate`; on IPFS failure leave prior state unchanged
    - _Requirements: 8.3, 8.4, 8.9_

  - [ ] 16.4 Write integration tests for certificate issuance and failure
    - Cover success (cid + tx) and IPFS-failure (no cert hash, state unchanged) paths
    - _Requirements: 8.3, 8.4, 8.9, 8.10_

- [ ] 17. Implement the AI Assistant module
  - [ ] 17.1 Implement the AI assistant service
    - Validate question length (<=2000), read on-chain figures read-only via ChainRead (unavailable on failure, never fabricated), scope the OpenAI system prompt, enforce a 30s timeout with retained history, and persist conversation history
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.8, 10.9_

  - [ ] 17.2 Write property test for AI question length boundary
    - **Property 29: AI question length boundary**
    - **Validates: Requirements 10.7**

  - [ ] 17.3 Write property test for AI non-signing guarantee
    - **Property 28: AI assistant never signs or submits transactions**
    - **Validates: Requirements 10.2**

  - [ ] 17.4 Write integration tests for AI timeout/unavailability
    - Assert 503 with retained history on timeout/unavailable and unavailable-figure handling on read failure
    - _Requirements: 10.8, 10.9_

  - [ ] 17.5 Checkpoint - backend test suite
    - Ensure all backend tests pass and coverage meets >=80% line; ask the user if questions arise.

- [ ] 18. Establish frontend foundation (Next.js)
  - [x] 18.1 Initialize the Next.js app and providers
    - Scaffold App Router with strict TS, Tailwind, and shadcn/ui; configure `WagmiProvider` + `RainbowKitProvider` (Base Sepolia only), TanStack Query client, and `ThemeProvider`
    - _Requirements: 2.1, 2.3, 11.7, 17.2_

  - [x] 18.2 Implement theming, accessibility, and responsive base
    - Light default on first visit, theme switch across pages without reload within 1s, session persistence; keyboard focus with visible ring and accessible labels; responsive breakpoints (320-767, 768-1023, >=1024)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

  - [ ] 18.3 Write component tests for theming, responsiveness, and a11y
    - Test theme apply/persist, no horizontal scroll at breakpoints, keyboard traversal and axe checks
    - _Requirements: 19.1, 19.2, 19.5, 19.6, 19.7_

- [ ] 19. Implement the frontend on-chain read layer
  - [x] 19.1 Implement read hooks with retry/timeout and state machine
    - Wrap viem reads with 10s per-attempt timeout and up to 3 retries; expose `{ data, isLoading, isError, refetch }`; render loading/error/retry states with no placeholder financial values
    - _Requirements: 1.2, 1.6, 1.7, 7.4, 7.5, 11.4, 11.5, 11.6_

  - [ ] 19.2 Write property test for the read retry policy
    - **Property 3: Read retry policy is bounded and correct**
    - **Validates: Requirements 1.6**

  - [ ] 19.3 Write component tests for loading/error/retry states
    - Assert error state offers working retry and never shows substituted values
    - _Requirements: 11.4, 11.5, 11.6_

- [ ] 20. Implement the frontend authentication flow
  - [ ] 20.1 Implement `useSiweAuth`, network guard, and `/auth` page
    - Orchestrate nonce -> SIWE message -> sign -> verify -> store JWT; prompt Base Sepolia switch before on-chain actions; handle connect/decline errors
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 20.2 Write component tests for the auth flow
    - Cover connect failure, wrong-network prompt, and sign decline paths
    - _Requirements: 2.2, 2.3, 2.5_

- [ ] 21. Implement the frontend pages
  - [ ] 21.1 Implement Landing and 404 pages
    - Static theme-aware landing hero and not-found route
    - _Requirements: 11.7_

  - [ ] 21.2 Implement the Dashboard page
    - Display savings, locked, goals, community contributions, achievements, and portfolio growth from on-chain reads; recent transactions (<=50, most-recent-first); charts from real data only
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.7_

  - [ ] 21.3 Implement the Savings page
    - Deposit/withdraw flows wired to SavingsVault with signed transactions and live reads
    - _Requirements: 4.2, 4.3, 11.7_

  - [ ] 21.4 Implement the Goals page
    - Create goal, contribute, and lock/withdraw-locked flows wired to SavingsVault
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 11.7_

  - [ ] 21.5 Implement the Community page
    - Create/join circles, contribute, and vote flows wired to CommunityTreasury
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 11.7_

  - [ ] 21.6 Implement the Investments page
    - Pool contribution, ownership share, and yield display from on-chain state with error-on-failure
    - _Requirements: 7.1, 7.4, 7.5, 11.7_

  - [ ] 21.7 Implement the Education page
    - Courses/progress from backend and certificates from the Education contract
    - _Requirements: 8.1, 8.3, 11.7_

  - [ ] 21.8 Implement the AI Assistant page
    - Chat UI calling `/ai/chat`; recommended actions require wallet signing in the frontend
    - _Requirements: 10.1, 10.5, 11.7_

  - [ ] 21.9 Implement the Profile page
    - Profile, verification, and reputation from Registry + IPFS; profile-doc upload
    - _Requirements: 3.3, 3.5, 3.7, 11.7_

  - [ ] 21.10 Implement the Settings page
    - Theme and preference controls persisted for the session
    - _Requirements: 19.1, 19.3, 11.7_

  - [ ] 21.11 Implement the Admin page (role-gated)
    - Admin-only operations gated by role with unauthorized access blocked
    - _Requirements: 14.9, 11.7_

  - [ ] 21.12 Write component tests for pages
    - Cover data-source wiring, loading/error/retry rendering, and role gating across pages
    - _Requirements: 11.1, 11.3, 11.4, 14.9, 15.5_

- [ ] 22. Implement frontend end-to-end tests
  - [ ] 22.1 Write Playwright e2e tests for primary user flows
    - Cover account creation, authentication, initiating a transaction, and viewing transaction history
    - _Requirements: 15.5_

  - [ ] 22.2 Checkpoint - frontend test suite
    - Ensure all frontend tests pass and coverage meets >=80% line; ask the user if questions arise.

- [ ] 23. Implement DevOps tooling
  - [ ] 23.1 Create multi-stage Dockerfiles for frontend and backend
    - Produce runnable images for both services
    - _Requirements: 16.1_

  - [ ] 23.2 Create the Docker Compose configuration
    - Start frontend, backend, PostgreSQL, and Redis with healthchecks reaching healthy within 120s
    - _Requirements: 16.2_

  - [ ] 23.3 Create the GitHub Actions CI workflow
    - Run lint -> test -> build within 30 minutes; fail and report the failing step, blocking deployment on failure
    - _Requirements: 16.3, 16.4, 15.6, 15.7, 15.8_

  - [x] 23.4 Configure Husky, Commitlint, and secret scanning
    - Add commit-message validation, pre-commit quality checks within 120s, and a staged-secret scan that blocks commits
    - _Requirements: 16.8, 17.6, 17.7_

- [ ] 24. Write documentation
  - [ ] 24.1 Write the README and environment/developer guide
    - Platform description, ordered local setup steps, description of every top-level directory, required tools/versions, env vars, and per-service build/start commands
    - _Requirements: 18.1, 18.6_

  - [ ] 24.2 Write the API documentation
    - Document every REST endpoint: method, path, params/body, response body, auth requirement, and error conditions/responses
    - _Requirements: 18.2, 18.3_

  - [ ] 24.3 Write the contract documentation
    - Document every contract's public/external functions, events, and roles generated from NatSpec
    - _Requirements: 18.4_

  - [x] 24.4 Write the deployment guide
    - Prerequisites and ordered steps for Base Sepolia contract deployment and service deployment
    - _Requirements: 18.5_

- [ ] 25. Final checkpoint
  - Ensure all suites pass across contracts, backend, and frontend and CI is green; ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirement clauses for traceability, and each property test references its design property number.
- Property-based tests run a minimum of 100 iterations: contract properties (7-9, 11-20, 22-26, 33) use Foundry fuzz/invariant runs; backend/frontend properties (1-6, 10, 18*, 21, 27-34) use `fast-check`. Property 18's off-chain lesson-dedupe facet (Req 8.8) is additionally covered by the Education module tests.
- Checkpoints enforce incremental validation and coverage targets (contracts >=90% line/branch, backend/frontend >=80% line).
- All financial values are read on-chain; the backend caches only with provenance and never serves stale or placeholder financial values.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "10.1", "23.4"] },
    { "id": 2, "tasks": ["1.3", "2.2", "10.2", "10.3", "18.1"] },
    { "id": 3, "tasks": ["3.1", "4.1", "5.1", "6.1", "7.1", "10.4", "11.1", "12.1", "13.1", "14.1", "15.1", "16.1", "18.2", "19.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "3.5", "4.2", "4.3", "4.4", "5.2", "5.3", "5.4", "5.5", "6.2", "6.3", "7.2", "7.3", "7.4", "7.5", "11.2", "11.3", "11.4", "11.5", "11.6", "12.2", "12.3", "12.4", "13.2", "13.3", "13.4", "14.2", "14.3", "15.2", "15.3", "16.2", "16.3", "17.1", "18.3", "19.2", "19.3", "20.1"] },
    { "id": 5, "tasks": ["4.5", "4.6", "4.7", "5.6", "5.7", "5.8", "16.4", "17.2", "17.3", "17.4", "20.2", "21.1", "21.2", "21.3", "21.4", "21.5", "21.6", "21.7", "21.8", "21.9", "21.10", "21.11"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "21.12", "23.1"] },
    { "id": 7, "tasks": ["9.1", "9.2", "22.1", "23.2", "23.3"] },
    { "id": 8, "tasks": ["24.1", "24.2", "24.3", "24.4"] }
  ]
}
```
