# Requirements Document

## Introduction

The Bonitah Financial Network (BFN) is a production-quality Web3 application that empowers Africans through financial education, decentralized savings, and community investing. BFN combines Consumer AI, blockchain smart contracts, DeFi mechanics, and social features so that users can learn, save, invest, and build wealth.

BFN is delivered as a monorepo comprising Solidity smart contracts deployed to the Base Sepolia test network, a Next.js frontend, a NestJS backend, an AI advisory service, an IPFS-based file storage integration, and supporting DevOps and documentation deliverables.

The system enforces a set of non-negotiable product rules: no mock, fake, or hardcoded financial data; every blockchain interaction occurs on Base Sepolia; every displayed balance is read from deployed smart contracts (the blockchain is the single source of truth for balances); every transaction is signed by the connected wallet; the AI advisory service is strictly read-only and never executes blockchain transactions; and the backend stores only off-chain data and never duplicates on-chain balances.

This document defines the requirements for BFN using EARS patterns and INCOSE quality rules. Requirements are grouped by scope area: smart contracts, frontend, backend, AI advisory, education, community, investments, file storage, security, testing, DevOps, documentation, code quality, and monorepo structure.

## Glossary

- **BFN**: The Bonitah Financial Network, the complete Web3 application described in this document.
- **System**: The BFN application as a whole, spanning smart contracts, frontend, backend, and AI advisory service.
- **Base_Sepolia**: The Base Sepolia Ethereum Layer 2 test network, the only chain on which BFN performs blockchain interactions.
- **Connected_Wallet**: An external cryptocurrency wallet controlled by the end user and connected to the frontend, which is the sole signer of all transactions.
- **User**: An authenticated end user of BFN who owns a Connected_Wallet.
- **Admin**: A user granted administrative privileges through on-chain access control roles.
- **Registry_Contract**: The `Registry.sol` smart contract that manages user registration, profiles, verification, and reputation.
- **SavingsVault_Contract**: The `SavingsVault.sol` smart contract that manages deposits, withdrawals, goal savings, locked savings, and portfolio calculation, with one vault per user.
- **CommunityTreasury_Contract**: The `CommunityTreasury.sol` smart contract that manages savings groups, contributions, voting, and treasury accounting.
- **Education_Contract**: The `Education.sol` smart contract that records completed lessons, certificates, badges, achievements, and education reputation as on-chain proofs.
- **Governance_Contract**: The `Governance.sol` smart contract that manages DAO governance, proposals, voting, treasury permissions, and upgradeable governance.
- **Frontend**: The Next.js web application that users interact with through a browser.
- **Backend**: The NestJS server application that stores off-chain data and exposes a REST API.
- **AI_Advisor**: The AI advisory service backed by the OpenAI API that provides read-only financial guidance.
- **IPFS_Store**: The InterPlanetary File System integration used to store certificates, metadata, and profile documents.
- **SIWE**: Sign-In With Ethereum, the wallet-based authentication mechanism used to authenticate users.
- **JWT**: A JSON Web Token issued by the Backend to represent an authenticated session.
- **Off_Chain_Data**: Data stored by the Backend that is not a blockchain balance, including articles, videos, notifications, AI conversations, cached blockchain events, and analytics.
- **Portfolio**: The aggregate view of a user's savings, locked savings, goals, community contributions, and investment holdings, computed from on-chain data.
- **Savings_Circle**: A community savings group managed by the CommunityTreasury_Contract.
- **Investment_Pool**: A transparent, on-chain investment pool tracking member ownership and contributions.
- **Reputation_Score**: A numeric on-chain measure of a user's standing derived from activity and verification.
- **IPFS_Hash**: A content-addressed identifier referencing data stored in the IPFS_Store.
- **Certificate**: A proof of course or lesson completion, recorded on-chain and with metadata stored in the IPFS_Store.

## Requirements

### Requirement 1: User Registration and Profile Management

**User Story:** As a new user, I want to register my identity and manage my profile on-chain, so that my presence in BFN is verifiable and self-owned.

#### Acceptance Criteria

1. WHEN a User submits a registration request signed by the Connected_Wallet, THE Registry_Contract SHALL record the User address and emit a registration event.
2. IF a registration request is submitted for a Connected_Wallet address that is already registered, THEN THE Registry_Contract SHALL revert with a custom error.
3. WHEN a registered User submits a profile update signed by the Connected_Wallet, THE Registry_Contract SHALL store the provided IPFS_Hash referencing the profile data and emit a profile-updated event.
4. WHERE a User has an IPFS profile document, THE Registry_Contract SHALL store only the IPFS_Hash on-chain and SHALL NOT store the document contents on-chain.
5. WHEN an Admin submits a verification request for a registered User signed by the Connected_Wallet, THE Registry_Contract SHALL mark the User as verified and emit a verification event.
6. THE Registry_Contract SHALL maintain a Reputation_Score for each registered User and SHALL emit an event whenever the Reputation_Score changes.
7. IF an unregistered address invokes a function that requires registration, THEN THE Registry_Contract SHALL revert with a custom error.

### Requirement 2: Personal Savings Vault

**User Story:** As a user, I want to deposit and withdraw savings in my own vault, so that I control my funds and can see accurate balances.

#### Acceptance Criteria

1. THE SavingsVault_Contract SHALL maintain exactly one vault per registered User.
2. WHEN a User submits a deposit signed by the Connected_Wallet, THE SavingsVault_Contract SHALL increase the User vault balance by the deposited amount and emit a deposit event.
3. WHEN a User submits a withdrawal signed by the Connected_Wallet for an amount less than or equal to the available vault balance, THE SavingsVault_Contract SHALL transfer the requested amount to the User and emit a withdrawal event.
4. IF a User submits a withdrawal for an amount greater than the available vault balance, THEN THE SavingsVault_Contract SHALL revert with a custom error.
5. WHEN a User creates a goal savings entry signed by the Connected_Wallet, THE SavingsVault_Contract SHALL record the goal target amount and deadline and emit a goal-created event.
6. WHEN a User locks savings for a specified duration signed by the Connected_Wallet, THE SavingsVault_Contract SHALL record the locked amount and unlock time and emit a savings-locked event.
7. IF a User submits a withdrawal of locked savings before the unlock time, THEN THE SavingsVault_Contract SHALL revert with a custom error.
8. THE SavingsVault_Contract SHALL calculate the Portfolio value for a User from on-chain vault balances, locked savings, and goal savings.

### Requirement 3: Community Treasury and Savings Circles

**User Story:** As a community member, I want to create and join savings circles with transparent accounting and voting, so that we can save and manage funds together with trust.

#### Acceptance Criteria

1. WHEN a registered User submits a group creation request signed by the Connected_Wallet, THE CommunityTreasury_Contract SHALL create a Savings_Circle, assign the creator as the group administrator, and emit a group-created event.
2. WHEN a registered User submits a join request signed by the Connected_Wallet for an existing Savings_Circle, THE CommunityTreasury_Contract SHALL record the join request and emit a join-requested event.
3. WHEN a group administrator approves a join request signed by the Connected_Wallet, THE CommunityTreasury_Contract SHALL add the User as a member and emit a member-added event.
4. WHEN a member submits a contribution signed by the Connected_Wallet, THE CommunityTreasury_Contract SHALL increase the Savings_Circle treasury balance by the contributed amount and emit a contribution event.
5. WHEN a member submits a vote on a treasury action signed by the Connected_Wallet, THE CommunityTreasury_Contract SHALL record the vote and emit a vote-cast event.
6. WHILE a treasury action has not reached its required approval threshold, THE CommunityTreasury_Contract SHALL prevent execution of that treasury action.
7. THE CommunityTreasury_Contract SHALL maintain a transparent accounting record of all contributions and disbursements for each Savings_Circle and SHALL emit an event for every balance change.
8. IF a non-member submits a contribution or vote for a Savings_Circle, THEN THE CommunityTreasury_Contract SHALL revert with a custom error.

### Requirement 4: Education Records and Achievements

**User Story:** As a learner, I want my completed lessons, certificates, and achievements recorded on-chain, so that my progress is verifiable and portable.

#### Acceptance Criteria

1. WHEN a User completes a lesson and submits a completion proof signed by the Connected_Wallet, THE Education_Contract SHALL record the completed lesson identifier for the User and emit a lesson-completed event.
2. WHEN a User earns a Certificate, THE Education_Contract SHALL record the Certificate with its IPFS_Hash metadata reference and emit a certificate-issued event.
3. WHEN a User earns a badge or achievement, THE Education_Contract SHALL record the achievement identifier for the User and emit an achievement-earned event.
4. THE Education_Contract SHALL store only proofs of completion, certificates, badges, and achievements on-chain and SHALL NOT store lesson or article content on-chain.
5. WHEN a User earns an education achievement, THE Education_Contract SHALL update the User education Reputation_Score and emit a reputation-updated event.
6. IF a completion proof is submitted for a lesson identifier that the User has already completed, THEN THE Education_Contract SHALL revert with a custom error.

### Requirement 5: DAO Governance

**User Story:** As a governance participant, I want to create and vote on proposals that control treasury permissions, so that the community can steer BFN transparently.

#### Acceptance Criteria

1. WHEN a registered User submits a proposal signed by the Connected_Wallet, THE Governance_Contract SHALL record the proposal and emit a proposal-created event.
2. WHEN a User casts a vote on an active proposal signed by the Connected_Wallet, THE Governance_Contract SHALL record the vote weight and emit a vote-cast event.
3. WHILE a proposal voting period is open, THE Governance_Contract SHALL accept votes on that proposal.
4. WHEN a proposal voting period ends and the proposal meets the approval quorum and threshold, THE Governance_Contract SHALL mark the proposal as passed and emit a proposal-passed event.
5. WHERE a passed proposal grants treasury permissions, THE Governance_Contract SHALL update the corresponding treasury permission and emit a permission-updated event.
6. THE Governance_Contract SHALL support upgradeable governance logic through an upgrade mechanism restricted to authorized roles.
7. IF a User casts a vote on a proposal after its voting period has ended, THEN THE Governance_Contract SHALL revert with a custom error.

### Requirement 6: Smart Contract Security and Quality

**User Story:** As a security-conscious stakeholder, I want all contracts to follow audit-grade security practices, so that user funds and data are protected.

#### Acceptance Criteria

1. THE System SHALL implement reentrancy protection on every smart contract function that transfers value or modifies balances.
2. THE System SHALL enforce role-based access control on every smart contract function restricted to privileged roles.
3. WHERE a contract exposes value-transferring functionality, THE System SHALL provide a pause capability that halts that functionality when the contract is paused.
4. WHILE a contract is paused, THE System SHALL reject state-changing user transactions to that contract with a custom error.
5. THE System SHALL use safe ERC-20 transfer operations for all token transfers.
6. THE System SHALL define custom errors for all revert conditions instead of revert strings.
7. THE System SHALL emit an event for every state change in every smart contract.
8. THE System SHALL include NatSpec documentation for every public and external smart contract function.
9. THE System SHALL deploy every smart contract to Base_Sepolia and SHALL perform every blockchain interaction on Base_Sepolia.

### Requirement 7: Wallet-Based Authentication (SIWE)

**User Story:** As a user, I want to sign in with my wallet, so that I control access to my account without passwords.

#### Acceptance Criteria

1. WHEN a User initiates sign-in, THE Backend SHALL issue a unique SIWE challenge message including a nonce.
2. WHEN a User submits a SIWE challenge signed by the Connected_Wallet, THE Backend SHALL verify the signature against the User address.
3. IF the submitted SIWE signature is invalid or the nonce has expired, THEN THE Backend SHALL reject the sign-in with an authentication error.
4. WHEN the Backend verifies a valid SIWE signature, THE Backend SHALL issue a JWT bound to the authenticated User address.
5. WHEN a User submits a request with an expired or invalid JWT, THE Backend SHALL reject the request with an authorization error.
6. THE Backend SHALL manage session state and assign roles to authenticated Users.

### Requirement 8: Live Dashboard

**User Story:** As a user, I want a dashboard that shows my real, live financial data, so that I can understand my complete financial picture at a glance.

#### Acceptance Criteria

1. WHEN a User opens the Dashboard, THE Frontend SHALL display the User savings balance read from the SavingsVault_Contract on Base_Sepolia.
2. WHEN a User opens the Dashboard, THE Frontend SHALL display locked savings, goals, community contributions, achievements, recent transactions, and Portfolio growth derived from on-chain data.
3. THE Frontend SHALL read every displayed balance from deployed smart contracts and SHALL NOT display mock, fake, or hardcoded balances.
4. THE Frontend SHALL render interactive charts using data derived from Base_Sepolia blockchain data.
5. IF on-chain data cannot be retrieved, THEN THE Frontend SHALL display an error state and SHALL NOT display placeholder financial values.

### Requirement 8b: Frontend Application Pages and Presentation

**User Story:** As a user, I want a complete, accessible, and professional interface, so that I can use every BFN feature comfortably on any device.

#### Acceptance Criteria

1. THE Frontend SHALL provide the following pages: Landing, Authentication, Dashboard, Savings, Goals, Community, Investments, Education, AI Assistant, Profile, Settings, Admin, and a 404 page.
2. WHEN a User requests a route that does not exist, THE Frontend SHALL display the 404 page.
3. WHEN a User toggles the color theme, THE Frontend SHALL switch between dark mode and light mode and SHALL persist the selection across sessions.
4. THE Frontend SHALL render a responsive layout across mobile, tablet, and desktop viewport widths.
5. THE Frontend SHALL meet WCAG 2.1 Level AA accessibility criteria for perceivable, operable, understandable, and robust content.
6. WHERE a page displays admin functionality, THE Frontend SHALL restrict access to Users holding the Admin role.

### Requirement 9: Transaction Signing by the Connected Wallet

**User Story:** As a user, I want to sign every transaction myself, so that no party can move my funds without my authorization.

#### Acceptance Criteria

1. WHEN a User initiates any blockchain state-changing action, THE Frontend SHALL request a signature from the Connected_Wallet before submitting the transaction.
2. IF the User rejects a signature request in the Connected_Wallet, THEN THE Frontend SHALL cancel the action and display a cancellation notice.
3. THE Frontend SHALL submit every blockchain transaction to Base_Sepolia.
4. THE System SHALL NOT hold custody of User private keys.

### Requirement 10: Backend Off-Chain Data Management

**User Story:** As a user, I want the backend to store supporting content and history, so that the application is fast and rich without duplicating on-chain balances.

#### Acceptance Criteria

1. THE Backend SHALL store only Off_Chain_Data, including articles, videos, notifications, AI conversations, cached blockchain events, and analytics.
2. THE Backend SHALL NOT store or duplicate blockchain balances.
3. WHEN the Backend caches a blockchain event, THE Backend SHALL record the event source, block number, and transaction hash.
4. THE Backend SHALL expose Off_Chain_Data through a REST API.
5. THE Backend SHALL run background workers to synchronize cached blockchain events from Base_Sepolia.
6. THE Backend SHALL validate every incoming request payload against a defined schema before processing.
7. IF a request payload fails validation, THEN THE Backend SHALL reject the request with a validation error describing the invalid fields.

### Requirement 11: AI Financial Advisor (Read-Only)

**User Story:** As a user, I want AI-driven financial guidance, so that I can make better decisions about budgeting, saving, and investing.

#### Acceptance Criteria

1. WHEN a User submits a financial question to the AI_Advisor, THE AI_Advisor SHALL return guidance covering budgeting, savings planning, investment education, goal recommendations, or Portfolio insights as applicable.
2. WHEN a User asks the AI_Advisor to explain a blockchain transaction, THE AI_Advisor SHALL return a plain-language explanation of that transaction.
3. THE AI_Advisor SHALL operate in read-only mode and SHALL NOT sign or execute any blockchain transaction.
4. WHERE the AI_Advisor recommends an on-chain action, THE AI_Advisor SHALL direct the User to perform the action so that the User signs it with the Connected_Wallet.
5. WHEN the AI_Advisor generates Portfolio insights, THE AI_Advisor SHALL base the insights on on-chain data read from Base_Sepolia.
6. THE Backend SHALL store AI conversation history as Off_Chain_Data.

### Requirement 12: Educational Platform

**User Story:** As a learner, I want structured educational content with progress tracking, so that I can build financial knowledge over time.

#### Acceptance Criteria

1. THE Backend SHALL store educational articles, videos, quizzes, and courses as Off_Chain_Data.
2. WHEN a User completes a quiz, THE System SHALL record the quiz result and update the User course progress.
3. WHEN a User completes all required components of a course, THE System SHALL issue a Certificate recorded through the Education_Contract.
4. THE System SHALL track each User learning streak based on consecutive days of learning activity.
5. WHEN a User meets an achievement condition, THE System SHALL award the achievement through the Education_Contract.

### Requirement 13: Community Social Features

**User Story:** As a community member, I want social features around savings circles, so that I can collaborate and stay motivated.

#### Acceptance Criteria

1. WHEN a member invites another User to a Savings_Circle, THE System SHALL record the invitation and notify the invited User.
2. WHEN a group administrator approves a join request, THE System SHALL add the User as a member through the CommunityTreasury_Contract.
3. THE System SHALL display each Savings_Circle contribution history derived from on-chain contribution events.
4. THE System SHALL display a community leaderboard ranked by on-chain contribution activity.
5. WHEN a member votes on a treasury action, THE System SHALL submit the vote to the CommunityTreasury_Contract signed by the Connected_Wallet.

### Requirement 14: Investment Pools

**User Story:** As an investor, I want transparent investment pools with clear ownership tracking, so that I can invest with the community and trust the accounting.

#### Acceptance Criteria

1. WHEN a User contributes to an Investment_Pool signed by the Connected_Wallet, THE System SHALL record the contribution and update the User ownership share on-chain.
2. THE System SHALL display each Investment_Pool ownership distribution derived from on-chain data.
3. THE System SHALL display each User contribution history for every Investment_Pool the User has joined.
4. THE System SHALL provide a yield distribution architecture capable of distributing future yields proportionally to ownership shares.
5. THE System SHALL read every Investment_Pool balance from deployed smart contracts on Base_Sepolia.

### Requirement 15: IPFS File Storage

**User Story:** As a user, I want certificates and documents stored on decentralized storage, so that they are durable and verifiable without exposing sensitive data.

#### Acceptance Criteria

1. WHEN a Certificate is issued, THE System SHALL store the Certificate metadata in the IPFS_Store and record the resulting IPFS_Hash on-chain.
2. WHEN a User uploads a profile document, THE System SHALL store the document in the IPFS_Store and record the resulting IPFS_Hash through the Registry_Contract.
3. THE System SHALL NOT store sensitive personal information in publicly accessible IPFS_Store content.
4. WHEN the Frontend displays IPFS-stored content, THE Frontend SHALL retrieve the content using the recorded IPFS_Hash.

### Requirement 16: API Security and Access Control

**User Story:** As a stakeholder, I want every endpoint protected and access least-privileged, so that the system resists abuse.

#### Acceptance Criteria

1. THE Backend SHALL require a valid JWT for every non-public API endpoint.
2. WHEN a User invokes an endpoint requiring a role the User does not hold, THE Backend SHALL reject the request with an authorization error.
3. THE Backend SHALL validate and sanitize all inputs on every endpoint before processing.
4. THE Backend SHALL grant each role the minimum permissions required for its function.
5. IF an endpoint receives a request exceeding the configured rate limit, THEN THE Backend SHALL reject the request with a rate-limit error.

### Requirement 17: Testing and Coverage

**User Story:** As a maintainer, I want comprehensive automated tests, so that changes are verified and regressions are caught.

#### Acceptance Criteria

1. THE System SHALL include unit tests for smart contracts, frontend, and backend components.
2. THE System SHALL include integration tests covering interactions between the Frontend, Backend, and smart contracts.
3. THE System SHALL include contract tests validating smart contract behavior on a Base_Sepolia-compatible environment.
4. THE System SHALL include end-to-end tests covering primary user journeys.
5. WHEN the test suite runs in the continuous integration pipeline, THE System SHALL report code coverage metrics.

### Requirement 18: DevOps and Deployment

**User Story:** As an operator, I want containerized builds and automated pipelines, so that BFN can be deployed reliably.

#### Acceptance Criteria

1. THE System SHALL provide Docker images for the Frontend and Backend.
2. THE System SHALL provide a Docker Compose configuration that runs the Frontend, Backend, PostgreSQL, and Redis together.
3. THE System SHALL provide GitHub Actions pipelines that build, test, and lint the codebase on each pull request.
4. THE System SHALL manage environment-specific configuration through environment variables and SHALL NOT commit secrets to the repository.
5. THE System SHALL provide deployment scripts for deploying smart contracts to Base_Sepolia and for deploying the Frontend and Backend.

### Requirement 19: Documentation

**User Story:** As a developer, I want thorough documentation, so that I can understand, build, and deploy BFN.

#### Acceptance Criteria

1. THE System SHALL provide a README describing the project, setup, and usage.
2. THE System SHALL provide architecture documentation including architecture diagrams.
3. THE System SHALL provide API documentation for the Backend REST API.
4. THE System SHALL provide smart contract documentation derived from NatSpec.
5. THE System SHALL provide a deployment guide, an environment setup guide, and a developer guide.

### Requirement 20: Code Quality and Architecture

**User Story:** As a maintainer, I want strict standards and clean architecture, so that the codebase stays maintainable.

#### Acceptance Criteria

1. THE System SHALL enforce strict TypeScript compiler settings across the Frontend and Backend.
2. THE System SHALL enforce linting with ESLint and formatting with Prettier across the codebase.
3. WHEN a developer creates a commit, THE System SHALL run pre-commit checks through Husky and validate the commit message through Commitlint.
4. IF a commit message does not conform to the configured convention, THEN THE System SHALL reject the commit.
5. THE System SHALL organize code using feature-based folders, dependency injection, and separation of concerns aligned with SOLID principles.

### Requirement 21: Monorepo Structure and Deliverables

**User Story:** As a contributor, I want a well-organized monorepo, so that each part of BFN has a clear home.

#### Acceptance Criteria

1. THE System SHALL organize deliverables into the following top-level directories: `contracts/`, `frontend/`, `backend/`, `shared/`, `docs/`, `docker/`, `.github/`, `scripts/`, `tests/`, and `deployment/`.
2. THE System SHALL place all Solidity smart contracts and their Foundry configuration in the `contracts/` directory.
3. THE System SHALL place shared TypeScript types and utilities used by both the Frontend and Backend in the `shared/` directory.
4. THE System SHALL place all documentation deliverables in the `docs/` directory.
5. THE System SHALL place Docker and Docker Compose configuration in the `docker/` directory and continuous integration workflows in the `.github/` directory.

### Requirement 22: Blockchain as the Source of Truth

**User Story:** As a user, I want the blockchain to be the authoritative source for all balances, so that displayed values are always trustworthy.

#### Acceptance Criteria

1. THE System SHALL treat deployed smart contracts on Base_Sepolia as the single source of truth for all financial balances.
2. WHEN the System displays any balance, THE System SHALL derive that balance from deployed smart contracts on Base_Sepolia.
3. THE System SHALL NOT use mock data, fake balances, or hardcoded financial values in any environment intended for user access.
4. WHEN cached blockchain data and on-chain data diverge, THE System SHALL treat the on-chain data as authoritative.
