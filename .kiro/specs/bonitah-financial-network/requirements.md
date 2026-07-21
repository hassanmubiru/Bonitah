# Requirements Document

## Introduction

Bonitah Financial Network (BFN) is a production-quality Web3 platform that empowers users across Africa through financial education, decentralized savings, and community investing. The platform integrates a Consumer AI assistant, blockchain-based savings and treasury management, DeFi-style investment pools, social savings circles, and an educational platform.

The defining architectural principle of BFN is that the blockchain is the single source of truth for all financial state. All financial balances, savings goals, community contributions, and on-chain proofs are read directly from smart contracts deployed on the Base Sepolia network. No financial value is ever mocked, faked, hardcoded, or duplicated in the off-chain database. Every transaction that changes on-chain state is signed by the user's connected wallet. The AI assistant provides guidance only and never initiates or signs blockchain transactions.

This document defines the requirements for the complete monorepo system, spanning smart contracts (Solidity/Foundry/OpenZeppelin), the frontend (Next.js/TypeScript/wagmi/viem/RainbowKit), the backend (NestJS/Prisma/PostgreSQL/Redis), the AI assistant (OpenAI), IPFS file storage, security controls, testing, DevOps, and documentation.

## Glossary

- **BFN**: Bonitah Financial Network, the complete platform described in this document.
- **Base_Sepolia**: The Base Sepolia test network (chain ID 84532) on which all BFN smart contracts are deployed and all blockchain interactions occur.
- **Connected_Wallet**: The user's self-custodial wallet connected to the frontend through RainbowKit/wagmi, used to sign transactions and authenticate.
- **Registry_Contract**: The `Registry.sol` smart contract responsible for user registration, profile updates, verification, reputation scores, and IPFS profile hashes.
- **Savings_Vault_Contract**: The `SavingsVault.sol` smart contract that manages per-user deposits, withdrawals, goal savings, locked savings, and portfolio calculation.
- **Community_Treasury_Contract**: The `CommunityTreasury.sol` smart contract that manages savings groups, contributions, voting, and transparent group accounting.
- **Education_Contract**: The `Education.sol` smart contract that records on-chain proofs of completed lessons, certificates, badges, achievements, and education-derived reputation.
- **Governance_Contract**: The `Governance.sol` smart contract that manages DAO proposals, voting, treasury permissions, and upgradeable governance.
- **Frontend**: The Next.js web application that users interact with.
- **Backend**: The NestJS API service, its background workers, and its data stores (PostgreSQL and Redis).
- **AI_Assistant**: The OpenAI-backed financial assistant feature that provides educational and advisory responses.
- **IPFS_Service**: The component responsible for storing and retrieving certificates, metadata, and profile documents on IPFS.
- **Event_Indexer**: The Backend background worker that reads emitted contract events from Base_Sepolia and caches them for query and analytics.
- **SIWE**: Sign-In With Ethereum, the wallet-based authentication mechanism.
- **Session**: An authenticated user session established after successful SIWE verification and represented by a JWT.
- **Off_Chain_Data**: Non-financial content stored in the Backend database, limited to articles, videos, quizzes, courses, notifications, AI conversations, cached blockchain events, and analytics.
- **Portfolio_Value**: The total value of a user's holdings, computed from Savings_Vault_Contract and Community_Treasury_Contract on-chain balances.
- **Reputation_Score**: A numeric score maintained on-chain in the Registry_Contract reflecting user activity and standing.
- **Savings_Circle**: A community savings group managed by the Community_Treasury_Contract.
- **Investment_Pool**: A transparent on-chain pool tracking member ownership and contribution history.
- **Admin_Role**: A least-privilege administrative role enforced through OpenZeppelin AccessControl on-chain and role-based authorization off-chain.

## Requirements

### Requirement 1: Blockchain As Source Of Truth

**User Story:** As a user, I want every financial value I see to come from the blockchain, so that I can trust that displayed balances are accurate and verifiable.

#### Acceptance Criteria

1. THE BFN SHALL execute all blockchain reads and writes against Base_Sepolia.
2. WHEN the Frontend displays any financial balance, THE Frontend SHALL derive that balance from data read from a deployed smart contract on Base_Sepolia.
3. THE Backend SHALL store only Off_Chain_Data and SHALL NOT store financial balances as a source of truth.
4. WHERE a financial value is cached for performance, THE Backend SHALL label the cached value with the source contract identifier and the block number from which it was derived, and SHALL treat the cached value as stale once it is more than 30 seconds old.
5. WHILE a cached financial value is stale, WHEN the value is requested, THE Backend SHALL re-read the value from the source contract on Base_Sepolia before returning it.
6. IF a contract read does not return a result within 10 seconds, THEN THE Frontend SHALL retry the read up to 3 times before treating the read as failed.
7. IF a contract read is treated as failed after all retries, THEN THE Frontend SHALL display an error state that identifies the affected value as unavailable and SHALL NOT display a substituted, cached, or placeholder value in its place.
8. THE BFN SHALL exclude mocked balances, fabricated financial data, and hardcoded financial values from all production code paths.

### Requirement 2: Wallet Connection And Authentication

**User Story:** As a user, I want to connect my wallet and sign in, so that I can access my account securely without a password.

#### Acceptance Criteria

1. WHEN a user initiates wallet connection, THE Frontend SHALL request connection through RainbowKit and establish a Connected_Wallet on Base_Sepolia.
2. IF wallet connection fails or is rejected by the user, THEN THE Frontend SHALL NOT establish a Connected_Wallet and SHALL display an error state indicating the connection was not completed.
3. IF a Connected_Wallet is on a network other than Base_Sepolia, THEN THE Frontend SHALL prompt the user to switch to Base_Sepolia before allowing on-chain actions.
4. WHEN a user requests sign-in, THE Frontend SHALL generate a SIWE message that includes a single-use nonce issued by the Backend and a message expiration time, and SHALL request a signature from the Connected_Wallet.
5. IF the user declines to sign the SIWE message, THEN THE Frontend SHALL cancel the sign-in request and SHALL NOT establish a Session.
6. WHEN the Backend receives a signed SIWE message, THE Backend SHALL verify the signature against the claimed wallet address and validate that the message nonce is previously unused and not expired before establishing a Session.
7. WHEN SIWE verification succeeds, THE Backend SHALL issue a JWT that identifies the authenticated wallet address and a Session expiry not exceeding 24 hours from issuance, and SHALL invalidate the associated nonce so it cannot be reused.
8. IF SIWE verification fails due to an invalid signature, an address mismatch, or an expired or previously used nonce, THEN THE Backend SHALL reject the sign-in request, SHALL NOT establish a Session, and SHALL return an authentication error.
9. WHEN a Session JWT expires, THE Backend SHALL reject subsequent authenticated requests using that JWT and return an authentication error.
10. THE Backend SHALL assign each authenticated wallet a role from a defined set of roles, defaulting to a least-privilege non-administrative role, for authorization decisions.

### Requirement 3: User Registration And Profile Management

**User Story:** As a user, I want to register and manage my profile on-chain, so that I have a verifiable identity within the platform.

#### Acceptance Criteria

1. WHEN a user submits a registration transaction signed by the Connected_Wallet, THE Registry_Contract SHALL record the wallet address as a registered user, initialize that user's Reputation_Score to zero, and emit a UserRegistered event.
2. IF a wallet address that is already registered submits a registration transaction, THEN THE Registry_Contract SHALL revert with a custom error and SHALL leave the existing registration record unchanged.
3. WHEN a registered user submits a profile update with a non-empty IPFS profile hash signed by the Connected_Wallet, THE Registry_Contract SHALL store the updated IPFS profile hash and emit a profile update event.
4. IF an unregistered wallet submits a profile update transaction, THEN THE Registry_Contract SHALL revert with a custom error and SHALL NOT store any profile hash.
5. WHERE a user uploads profile documents, THE IPFS_Service SHALL accept up to 10 documents per request with each document no larger than 10 MB, store the accepted documents on IPFS, and return a content hash for on-chain reference.
6. WHEN an account holding the verifier permission submits a verification transaction for a user, THE Registry_Contract SHALL mark that user as verified and emit a verification event.
7. THE Registry_Contract SHALL maintain a Reputation_Score for each registered user as a non-negative integer with an initial value of zero.
8. THE IPFS_Service SHALL exclude government identification numbers, residential address details, phone numbers, email addresses, and financial account credentials from any publicly readable IPFS content.
9. IF the IPFS_Service fails to store an uploaded profile document, THEN THE IPFS_Service SHALL return an error indicating the storage failure and SHALL NOT return a content hash.
10. IF an account without the verifier permission submits a verification transaction, THEN THE Registry_Contract SHALL revert with a custom error and SHALL NOT change the user's verification state.

### Requirement 4: Personal Savings Vault

**User Story:** As a user, I want to deposit and withdraw savings in my own vault, so that I can save securely on-chain.

#### Acceptance Criteria

1. THE Savings_Vault_Contract SHALL associate exactly one vault with each registered user.
2. WHEN a registered user submits a deposit transaction for an amount greater than zero signed by the Connected_Wallet, THE Savings_Vault_Contract SHALL credit the deposited amount to that user's vault and emit a DepositMade event.
3. WHEN a registered user submits a withdrawal transaction for an amount greater than zero not exceeding the user's available vault balance, defined as the user's deposited balance excluding any locked amounts, THE Savings_Vault_Contract SHALL transfer the requested amount to the user, reduce the user's available balance by that amount, and emit a WithdrawalMade event.
4. IF a user submits a withdrawal transaction for an amount exceeding the available vault balance, THEN THE Savings_Vault_Contract SHALL revert with a custom error and leave the user's balance unchanged.
5. THE Savings_Vault_Contract SHALL use SafeERC20 for all ERC20 token transfers.
6. THE Savings_Vault_Contract SHALL apply reentrancy protection to deposit and withdrawal functions.
7. WHILE the Savings_Vault_Contract is paused, THE Savings_Vault_Contract SHALL reject deposit and withdrawal transactions with a custom error.
8. IF an unregistered wallet submits a deposit or withdrawal transaction, THEN THE Savings_Vault_Contract SHALL revert with a custom error.
9. IF a user submits a deposit or withdrawal transaction for an amount of zero, THEN THE Savings_Vault_Contract SHALL revert with a custom error.

### Requirement 5: Goal Savings And Locked Savings

**User Story:** As a user, I want to create savings goals and lock funds, so that I can commit to targets and reduce the temptation to withdraw early.

#### Acceptance Criteria

1. WHEN a user submits a goal creation transaction with a target amount greater than zero and a target date later than the current block timestamp signed by the Connected_Wallet, THE Savings_Vault_Contract SHALL record the goal for that user and emit a GoalCreated event.
2. WHEN a user's cumulative goal savings reach or exceed the goal target amount, THE Savings_Vault_Contract SHALL mark the goal as completed and emit a GoalCompleted event.
3. WHEN a user submits a locked savings transaction with a lock duration between 1 day and 5 years inclusive and a locked amount not exceeding the user's available balance signed by the Connected_Wallet, THE Savings_Vault_Contract SHALL record the locked amount and set the lock expiry timestamp to the current block timestamp plus the lock duration.
4. IF a user submits a withdrawal of locked savings before the lock expiry timestamp, THEN THE Savings_Vault_Contract SHALL revert with a custom error and retain the locked amount.
5. WHEN a user submits a withdrawal of locked savings at or after the lock expiry timestamp, THE Savings_Vault_Contract SHALL release the locked amount to the user's available balance.
6. THE Savings_Vault_Contract SHALL compute Portfolio_Value for a user from that user's deposited, goal, and locked balances.
7. IF a user submits a goal creation transaction with a target amount of zero or a target date at or before the current block timestamp, THEN THE Savings_Vault_Contract SHALL revert with a custom error and SHALL NOT record a goal.
8. IF a user submits a locked savings transaction with a lock duration outside the range of 1 day to 5 years inclusive or a locked amount exceeding the user's available balance, THEN THE Savings_Vault_Contract SHALL revert with a custom error and SHALL NOT lock any funds.

### Requirement 6: Community Savings Circles And Treasury

**User Story:** As a community organizer, I want to create and manage savings circles, so that members can pool and govern funds transparently.

#### Acceptance Criteria

1. WHEN a user submits a group creation transaction signed by the Connected_Wallet specifying a maximum member count between 2 and 1000 inclusive and an approval threshold expressed as a whole-number percentage between 1 and 100 inclusive, THE Community_Treasury_Contract SHALL create a Savings_Circle with the creator as an initial member, persist the specified maximum member count and approval threshold, and emit a PoolCreated event.
2. WHEN a user who is not already a member of the Savings_Circle submits a join transaction for a Savings_Circle that is open for membership and whose current member count is below its stored maximum member count, THE Community_Treasury_Contract SHALL add the user as a member of that Savings_Circle.
3. WHEN a member submits a contribution transaction signed by the Connected_Wallet for an amount greater than zero, THE Community_Treasury_Contract SHALL credit the contribution to the Savings_Circle treasury and emit a ContributionMade event.
4. WHEN a member who has not already voted on a given treasury action submits a vote on that treasury action, THE Community_Treasury_Contract SHALL record the vote and emit a VoteCast event.
5. IF a non-member submits a contribution or vote transaction for a Savings_Circle, THEN THE Community_Treasury_Contract SHALL revert with a custom error and SHALL make no change to treasury balances or recorded votes.
6. THE Community_Treasury_Contract SHALL maintain a per-member contribution history for each Savings_Circle.
7. WHEN the cumulative approving votes recorded for a treasury action reach or exceed the Savings_Circle's stored approval threshold, THE Community_Treasury_Contract SHALL execute the approved treasury action.
8. THE Community_Treasury_Contract SHALL apply reentrancy protection to contribution and treasury disbursement functions.
9. IF a user submits a join transaction for a Savings_Circle that is not open for membership, or whose current member count has reached its stored maximum member count, or for which the user is already a member, THEN THE Community_Treasury_Contract SHALL revert with a custom error and SHALL not add the user as a member.
10. IF a member submits a vote on a treasury action for which that member has already recorded a vote, THEN THE Community_Treasury_Contract SHALL revert with a custom error and SHALL retain the previously recorded vote.
11. IF a group creation transaction specifies a maximum member count outside the range 2 to 1000 inclusive or an approval threshold outside the range 1 to 100 inclusive, THEN THE Community_Treasury_Contract SHALL revert with a custom error and SHALL not create a Savings_Circle.

### Requirement 7: Investment Pools

**User Story:** As an investor, I want to contribute to transparent investment pools, so that my ownership and contributions are tracked verifiably.

#### Acceptance Criteria

1. WHEN a user submits a pool contribution transaction with a contribution amount greater than zero signed by the Connected_Wallet, THE Community_Treasury_Contract SHALL credit the contribution to the Investment_Pool, recompute that user's ownership share as the ratio of that user's cumulative contributions to the Investment_Pool's total contributions, and emit a ContributionMade event.
2. IF a user submits a pool contribution transaction with a contribution amount of zero, THEN THE Community_Treasury_Contract SHALL revert with a custom error and leave the user's ownership share and the Investment_Pool total unchanged.
3. THE Community_Treasury_Contract SHALL maintain a contribution history for each member of an Investment_Pool that records each contribution amount and the block timestamp at which it was recorded.
4. WHEN the Frontend displays a user's ownership share, THE Frontend SHALL derive the share from the Investment_Pool on-chain state on Base_Sepolia.
5. IF the on-chain read of Investment_Pool state fails, THEN THE Frontend SHALL display an error state that identifies the ownership share as unavailable rather than displaying a substituted value.
6. THE Community_Treasury_Contract SHALL expose an interface that computes each pool member's yield distribution amount in proportion to that member's ownership share.

### Requirement 8: Education Platform

**User Story:** As a learner, I want to complete courses and earn on-chain certificates, so that I can build verifiable financial knowledge and reputation.

#### Acceptance Criteria

1. THE Backend SHALL store articles, videos, quizzes, and courses as Off_Chain_Data.
2. WHEN a user completes a lesson not previously recorded as completed for that user, THE Backend SHALL record the lesson completion, update the user's course progress, and update the user's learning streak, defined as the number of consecutive calendar days on which the user has completed at least one lesson, in Off_Chain_Data.
3. WHEN a user completes every lesson within a course, THE Education_Contract SHALL record the course completion proof on-chain, issue the certificate, and emit a CertificateIssued event.
4. WHERE a certificate is issued, THE IPFS_Service SHALL store the certificate metadata on IPFS and THE Education_Contract SHALL store the returned content hash on-chain.
5. THE Education_Contract SHALL record badges and achievements as on-chain proofs.
6. THE Education_Contract SHALL store only completion proofs on-chain and SHALL store lesson content and certificate metadata off-chain.
7. WHEN a user earns an education achievement, THE Education_Contract SHALL increase that user's Reputation_Score by a defined non-negative amount configured for the earned achievement type.
8. IF a user submits a lesson completion for a lesson already recorded as completed for that user, THEN THE Backend SHALL reject the duplicate completion and SHALL NOT change the user's course progress or learning streak.
9. IF storing certificate metadata on IPFS fails during certificate issuance, THEN THE Education_Contract SHALL NOT record the certificate content hash, THE IPFS_Service SHALL return an error indicating the storage failure, and the user's prior education state SHALL remain unchanged.
10. IF a user submits a course completion for a course for which that user has already been issued a certificate, THEN THE Education_Contract SHALL revert with a custom error.

### Requirement 9: DAO Governance

**User Story:** As a community member, I want to propose and vote on governance actions, so that platform and treasury decisions are made collectively.

#### Acceptance Criteria

1. WHEN an eligible user, defined as a registered user holding governance voting power greater than zero, submits a proposal creation transaction signed by the Connected_Wallet, THE Governance_Contract SHALL record the proposal in an active voting state with a voting period end timestamp and emit a proposal created event.
2. WHEN an eligible user submits a vote on a proposal that is in an active voting state, THE Governance_Contract SHALL record the vote weighted by the user's governance voting power and emit a VoteCast event.
3. IF a user submits a vote on a proposal that is not in an active voting state, THEN THE Governance_Contract SHALL revert with a custom error.
4. WHEN a proposal reaches its required quorum and approval threshold at the end of its voting period, THE Governance_Contract SHALL mark the proposal as passed.
5. WHEN a proposal's voting period ends without reaching its required quorum or approval threshold, THE Governance_Contract SHALL mark the proposal as rejected.
6. WHERE the marking operation for a passed proposal has not completed, THE Governance_Contract SHALL determine the proposal outcome from the recorded voting results.
7. THE Governance_Contract SHALL enforce treasury permissions through least-privilege access control, restricting treasury operations to the roles granted those operations.
8. THE Governance_Contract SHALL support upgradeable governance logic while preserving recorded proposal and voting state across upgrades.
9. IF an eligible user submits a vote on a proposal for which that user has already recorded a vote, THEN THE Governance_Contract SHALL revert with a custom error and retain the previously recorded vote.
10. IF an account invokes a treasury operation without holding a role granted that operation, THEN THE Governance_Contract SHALL revert with a custom error.

### Requirement 10: AI Financial Assistant

**User Story:** As a user, I want an AI assistant that gives me financial guidance, so that I can make informed decisions about budgeting, saving, and investing.

#### Acceptance Criteria

1. WHEN a user submits a question of at most 2,000 characters to the AI_Assistant, THE AI_Assistant SHALL return, within 30 seconds, a response providing guidance limited to budgeting, savings planning, investment education, goal recommendations, transaction explanation, and portfolio insights.
2. THE AI_Assistant SHALL NOT initiate, sign, or submit any blockchain transaction.
3. WHEN the AI_Assistant references a user's financial figures, THE AI_Assistant SHALL derive those figures from on-chain data read from Base_Sepolia contracts.
4. THE Backend SHALL store AI conversation history as Off_Chain_Data.
5. WHEN the AI_Assistant recommends a financial action that requires an on-chain transaction, THE Frontend SHALL require the user to sign that transaction with the Connected_Wallet before execution.
6. IF a transaction reaches the Backend or a BFN smart contract without a valid Connected_Wallet signature, THEN THE Backend or the BFN smart contract SHALL reject the transaction.
7. IF a user submits a question exceeding 2,000 characters, THEN THE AI_Assistant SHALL reject the question and return an error indicating the maximum allowed question length, without generating a response.
8. IF the AI_Assistant does not produce a response within 30 seconds or the underlying AI service is unavailable, THEN THE Backend SHALL return an error indicating that the assistant is temporarily unavailable and SHALL retain the existing conversation history.
9. IF an on-chain read required to reference a user's financial figures fails, THEN THE AI_Assistant SHALL indicate that the requested financial figures are unavailable and SHALL NOT substitute an estimated or fabricated value.

### Requirement 11: Dashboard And Live Data Display

**User Story:** As a user, I want a dashboard showing my real financial data, so that I can monitor my savings, goals, and community activity at a glance.

#### Acceptance Criteria

1. WHEN a user opens the Dashboard, THE Frontend SHALL display savings balance, locked savings, goals, community contributions, achievements, and portfolio growth derived from Base_Sepolia contract data, where portfolio growth is the trend of the user's Portfolio_Value over time.
2. WHEN a user opens the Dashboard, THE Frontend SHALL display the user's most recent transactions, up to a maximum of 50, ordered most recent first.
3. WHEN the Frontend renders interactive charts, THE Frontend SHALL populate those charts from real Base_Sepolia contract data and SHALL NOT use mocked or hardcoded values.
4. WHILE on-chain data for a dashboard section is being fetched, THE Frontend SHALL display a loading state for that section and SHALL NOT display a substituted or placeholder financial value.
5. IF an on-chain data fetch for a dashboard section does not complete within 30 seconds, THEN THE Frontend SHALL transition that section from the loading state to an error state.
6. IF an on-chain data fetch for a dashboard section fails, THEN THE Frontend SHALL display an error state for that section and offer a retry action that re-initiates the section fetch.
7. THE Frontend SHALL provide the Landing, Authentication, Dashboard, Savings, Goals, Community, Investments, Education, AI Assistant, Profile, Settings, Admin, and 404 pages.

### Requirement 12: Event Indexing And Analytics

**User Story:** As a user, I want fast access to my transaction history and platform analytics, so that I can review activity without slow on-chain scans.

#### Acceptance Criteria

1. WHEN a BFN contract emits a state-change event on Base_Sepolia, THE Event_Indexer SHALL read the event and cache it in the Backend database within 60 seconds of the block containing the event being finalized.
2. THE Backend SHALL mark cached blockchain events as derived data referencing the originating contract address, transaction hash, and block number.
3. WHEN an authenticated user requests transaction history, THE Backend SHALL return the cached events associated with that requesting user's own wallet address ordered by descending block number, in pages of at most 100 events per response.
4. WHEN a user requests transaction history and no cached events exist for that user's wallet address, THE Backend SHALL return an empty result set rather than an error.
5. IF the Event_Indexer detects a chain reorganization affecting cached events, THEN THE Event_Indexer SHALL remove cached events that are not present in the canonical Base_Sepolia chain state and re-cache the canonical events for the affected block range.
6. IF the Event_Indexer cannot read events from Base_Sepolia because the network connection is unavailable, THEN THE Event_Indexer SHALL retry reading the affected blocks and SHALL resume caching from the last successfully cached block number once the connection is restored, without skipping intervening blocks.

### Requirement 13: Contract Event Emission

**User Story:** As an integrator, I want every state change emitted as an event, so that off-chain systems can index platform activity reliably.

#### Acceptance Criteria

1. WHEN the Registry_Contract registers a user, THE Registry_Contract SHALL emit exactly one UserRegistered event within the same transaction, including the registered wallet address.
2. WHEN the Savings_Vault_Contract records a deposit, THE Savings_Vault_Contract SHALL emit exactly one DepositMade event within the same transaction, including the depositor's wallet address and the deposited amount.
3. WHEN the Savings_Vault_Contract records a withdrawal, THE Savings_Vault_Contract SHALL emit exactly one WithdrawalMade event within the same transaction, including the withdrawer's wallet address and the withdrawn amount.
4. WHEN the Savings_Vault_Contract creates a goal, THE Savings_Vault_Contract SHALL emit exactly one GoalCreated event within the same transaction, including the user's wallet address and the goal identifier.
5. WHEN the Savings_Vault_Contract completes a goal, THE Savings_Vault_Contract SHALL emit exactly one GoalCompleted event within the same transaction, including the user's wallet address and the goal identifier.
6. WHEN the Community_Treasury_Contract creates a group or pool, THE Community_Treasury_Contract SHALL emit exactly one PoolCreated event within the same transaction, including the creator's wallet address and the group or pool identifier.
7. WHEN the Community_Treasury_Contract records a contribution, THE Community_Treasury_Contract SHALL emit exactly one ContributionMade event within the same transaction, including the contributor's wallet address, the group or pool identifier, and the contribution amount.
8. WHEN the Governance_Contract or the Community_Treasury_Contract records a vote, THE recording contract SHALL emit exactly one VoteCast event within the same transaction, including the voter's wallet address and the proposal or treasury action identifier.
9. WHEN the Education_Contract issues a certificate, THE Education_Contract SHALL emit exactly one CertificateIssued event within the same transaction, including the recipient's wallet address and the certificate identifier.
10. IF a contract function reverts, THEN THE contract SHALL NOT emit any state-change event for that function invocation.

### Requirement 14: Security And Access Control

**User Story:** As a security-conscious stakeholder, I want strong security controls across the stack, so that user funds and data are protected.

#### Acceptance Criteria

1. THE Backend SHALL require a valid, unexpired Session JWT identifying an authenticated wallet address for every non-public API endpoint.
2. IF a request to a non-public API endpoint arrives with a missing, malformed, or expired Session JWT, THEN THE Backend SHALL reject the request without processing it and return an authentication error indicating that valid authentication is required.
3. WHEN the Backend receives request input, THE Backend SHALL validate every input field against a defined schema, including required-field presence, data type, and value bounds, before processing the request.
4. IF request input fails schema validation, THEN THE Backend SHALL reject the request without processing it, leave persisted state unchanged, and return a validation error identifying that the input was invalid.
5. THE BFN smart contracts SHALL enforce privileged operations through OpenZeppelin AccessControl, granting each role only the operations required for its function.
6. THE BFN smart contracts that transfer value SHALL apply reentrancy protection to every value-transferring external and public function.
7. WHEN an account without the required role invokes a privileged contract function, THE contract SHALL revert with a custom error and leave contract state unchanged.
8. THE BFN smart contracts SHALL define a custom error for each revert condition and SHALL include NatSpec documentation for every public and external function.
9. WHERE an account holds the Admin_Role, THE BFN SHALL permit that account only the operations granted to the Admin_Role and SHALL reject any operation outside that role's granted permissions.

### Requirement 15: Testing Coverage

**User Story:** As a maintainer, I want comprehensive automated tests, so that I can change the system with confidence.

#### Acceptance Criteria

1. THE contracts test suite SHALL include at least one passing unit test for every public and external contract function, achieving a minimum of 90% line and branch coverage across those functions.
2. THE contracts test suite SHALL include at least one test asserting that each state-change event is emitted with the expected argument values.
3. THE contracts test suite SHALL include at least one revert-condition test for each defined custom error, asserting that the specific expected error is raised.
4. THE Backend test suite SHALL include unit and integration tests covering every API endpoint and every background worker, achieving a minimum of 80% line coverage across the backend codebase.
5. THE Frontend test suite SHALL include component tests achieving a minimum of 80% line coverage and end-to-end tests covering each of the primary user flows (account creation, authentication, initiating a transaction, and viewing transaction history).
6. WHEN the test suites are executed, THE BFN SHALL report, for each individual test, a result of pass or fail, together with the total counts of passed, failed, and skipped tests.
7. IF one or more tests fail during execution, THEN THE BFN SHALL report an overall failure result and indicate each failing test by name.
8. IF a test suite cannot start execution due to a configuration or dependency error, THEN THE BFN SHALL report an error indicating the cause and SHALL report an overall failure result rather than reporting zero tests as passed.

### Requirement 16: DevOps And Deployment

**User Story:** As an operator, I want containerized builds and automated pipelines, so that I can deploy the platform reliably.

#### Acceptance Criteria

1. THE BFN SHALL provide Docker images for the Frontend and Backend services, and each image build SHALL complete successfully and produce a runnable container.
2. THE BFN SHALL provide a Docker Compose configuration that starts the Frontend, Backend, PostgreSQL, and Redis services together, with each service reaching a healthy state within 120 seconds of startup.
3. WHEN a change is pushed to the repository, THE GitHub Actions pipeline SHALL run linting, tests, and build steps, completing the full run within 30 minutes.
4. IF any linting, test, or build step fails, THEN THE GitHub Actions pipeline SHALL mark the pipeline run as failed, report the failing step with an indication of the failure cause, and SHALL NOT proceed to any subsequent deployment step.
5. THE BFN SHALL provide deployment scripts that deploy the smart contracts to Base_Sepolia and SHALL report the deployed contract addresses upon successful completion.
6. IF a smart contract deployment to Base_Sepolia fails, THEN THE deployment script SHALL terminate with a non-zero exit status, report an error indicating which contract failed to deploy, and SHALL NOT report any partial deployment as successful.
7. THE BFN SHALL manage environment-specific configuration through environment variables and SHALL exclude all secret values from version control.
8. IF a file containing a secret value is staged for commit, THEN THE BFN SHALL block the commit and report an error indicating that a secret was detected.

### Requirement 17: Repository Structure And Code Quality

**User Story:** As a developer, I want a well-organized, high-quality monorepo, so that I can navigate and extend the codebase efficiently.

#### Acceptance Criteria

1. THE BFN SHALL organize the codebase into a monorepo containing exactly the following top-level directories: contracts, frontend, backend, shared, docs, docker, github workflows, scripts, deployment, and tests.
2. THE Frontend and Backend SHALL compile under strict TypeScript configuration with zero type errors and zero type warnings.
3. WHEN linting is executed on the codebase, THE ESLint and Prettier configuration SHALL complete with zero lint errors and zero formatting violations.
4. IF linting reports one or more errors or formatting violations, THEN THE BFN SHALL return a non-zero exit status and indicate each violating file and line, and SHALL NOT report the codebase as compliant.
5. THE BFN production source SHALL contain zero TODO placeholders, zero unreferenced (dead) code blocks, zero mock implementations, and zero duplicated code blocks exceeding 50 tokens or 5 consecutive lines.
6. WHEN a commit is created, THE Husky and Commitlint hooks SHALL validate the commit message against the configured convention and execute the pre-commit quality checks within 120 seconds.
7. IF the commit message fails Commitlint validation or any pre-commit quality check fails, THEN THE BFN SHALL reject the commit, preserve the staged changes unchanged, and indicate the specific validation or check that failed.

### Requirement 18: Documentation

**User Story:** As a new contributor, I want complete documentation, so that I can set up, understand, and deploy the platform.

#### Acceptance Criteria

1. THE BFN SHALL provide a README that includes a platform description, an ordered list of setup steps sufficient to run the platform locally, and a description of every top-level directory in the repository structure.
2. THE BFN SHALL provide API documentation that covers every Backend REST endpoint, and for each endpoint documents the HTTP method, the path, the request parameters and body fields, the response body structure, and the authentication requirement.
3. IF a Backend REST endpoint returns an error condition, THEN THE BFN SHALL document the error condition and the corresponding failure response for that endpoint in the API documentation.
4. THE BFN SHALL provide smart contract documentation that covers every deployed contract, and for each contract documents all public and external functions, all emitted events, and all defined roles.
5. THE BFN SHALL provide a deployment guide that lists the required prerequisites and provides ordered, step-by-step instructions for Base_Sepolia contract deployment and for service deployment.
6. THE BFN SHALL provide environment setup and developer guide documentation that lists every required tool with its minimum version, every required environment variable, and the ordered commands to build and start each service.

### Requirement 19: Accessibility, Theming, And Responsiveness

**User Story:** As a user on any device, I want an accessible, responsive interface with light and dark modes, so that I can use the platform comfortably.

#### Acceptance Criteria

1. THE Frontend SHALL provide both a light mode theme and a dark mode theme, and SHALL apply a default theme of light mode on a user's first visit when no prior theme selection exists for the Session.
2. WHEN a user changes the theme, THE Frontend SHALL apply the selected theme across all pages without requiring a page reload and within 1 second of the change.
3. WHEN a user changes the theme, THE Frontend SHALL persist the selection for the duration of the Session independently of theme application.
4. WHEN a user navigates to any page during an active Session with a previously persisted theme selection, THE Frontend SHALL render that page using the persisted theme.
5. THE Frontend SHALL render responsive layouts without horizontal scrolling for mobile viewport widths of 320px to 767px, tablet viewport widths of 768px to 1023px, and desktop viewport widths of 1024px and above.
6. THE Frontend SHALL provide keyboard navigation for all interactive elements, allowing each interactive element to receive focus and be activated using standard keyboard input, with a visible focus indicator on the currently focused element.
7. THE Frontend SHALL provide accessible text labels for all interactive elements such that each interactive element has a programmatically associated name discernible by assistive technologies.
