# BFN Smart Contract Documentation

Complete documentation for all Bonitah Financial Network smart contracts deployed on Base Sepolia (Chain ID: 84532).

**Architecture**: All contracts use UUPS (Universal Upgradeable Proxy Standard) pattern with role-based access control.

---

## 📋 Contract Overview

| Contract | Purpose | Proxy Pattern | Access Control |
|----------|---------|---------------|----------------|
| Registry | User registration & reputation | UUPS | Role-based |
| SavingsVault | Deposits, withdrawals, goals, locks | UUPS | Role-based |
| CommunityTreasury | Investment circles & pools | UUPS | Role-based |
| Education | Certificates & achievements | UUPS | Role-based |
| Governance | Proposals & weighted voting | UUPS | Role-based |

---

## 🏗️ Contract Architecture

### Role System (BFNRoles)

All contracts inherit role-based access control:

```solidity
bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
bytes32 public constant REPUTATION_ROLE = keccak256("REPUTATION_ROLE");
bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
```

### UUPS Upgradeable Pattern

All contracts implement `_authorizeUpgrade()` with admin-only access for future upgrades while preserving storage and state.

---

## 📝 Registry Contract

**Purpose**: User registration, profile management, verification, and reputation tracking.

**Address**: `getContractAddress(84532, 'Registry')`

### Public Functions

#### `register()`

Register a new user account.

```solidity
function register() external
```

**Requirements**:
- Caller must not already be registered
- Emits `UserRegistered(address user, uint256 timestamp)`

**Reverts**:
- `AlreadyRegistered(address user)` - User already registered

---

#### `updateProfile(string memory profileHash)`

Update user's IPFS profile hash.

```solidity
function updateProfile(string memory profileHash) external
```

**Parameters**:
- `profileHash` - IPFS hash of profile metadata

**Requirements**:
- Caller must be registered
- Profile hash must not be empty
- Emits `ProfileUpdated(address user, string profileHash)`

**Reverts**:
- `NotRegistered(address user)` - User not registered
- `EmptyProfileHash()` - Empty profile hash provided

---

#### `verifyUser(address user)`

Verify a registered user (VERIFIER_ROLE only).

```solidity
function verifyUser(address user) external onlyRole(VERIFIER_ROLE)
```

**Parameters**:
- `user` - Address to verify

**Requirements**:
- Caller must have VERIFIER_ROLE
- User must be registered
- User must not already be verified
- Emits `UserVerified(address user, address verifier)`

**Reverts**:
- `NotRegistered(address user)` - User not registered
- `AlreadyVerified(address user)` - User already verified

---

#### `increaseReputation(address user, uint256 amount)`

Increase user reputation (REPUTATION_ROLE only).

```solidity
function increaseReputation(address user, uint256 amount) external onlyRole(REPUTATION_ROLE)
```

**Parameters**:
- `user` - User to reward
- `amount` - Reputation points to add

**Requirements**:
- Caller must have REPUTATION_ROLE
- User must be registered
- Amount must be > 0
- Emits `ReputationIncreased(address user, uint256 amount, uint256 newScore)`

**Reverts**:
- `NotRegistered(address user)` - User not registered
- `InvalidAmount()` - Amount is 0

---

### View Functions

#### `isRegistered(address user) → bool`

Check if user is registered.

#### `isVerified(address user) → bool`

Check if user is verified.

#### `reputationOf(address user) → uint256`

Get user's reputation score.

#### `profileOf(address user) → (uint256 registeredAt, string profileHash, bool verified)`

Get complete user profile information.

---

### Events

```solidity
event UserRegistered(address indexed user, uint256 timestamp);
event ProfileUpdated(address indexed user, string profileHash);
event UserVerified(address indexed user, address indexed verifier);
event ReputationIncreased(address indexed user, uint256 amount, uint256 newScore);
```

---

## 💰 SavingsVault Contract

**Purpose**: Secure deposits, withdrawals, financial goals, and time-locked savings.

**Address**: `getContractAddress(84532, 'SavingsVault')`

### Public Functions

#### `deposit(uint256 amount)`

Deposit tokens into the vault.

```solidity
function deposit(uint256 amount) external nonReentrant whenNotPaused
```

**Parameters**:
- `amount` - Amount of tokens to deposit

**Requirements**:
- Caller must be registered in Registry
- Amount must be > 0
- Caller must have sufficient token balance and approval
- Contract must not be paused
- Emits `DepositMade(address user, uint256 amount)`

**Reverts**:
- `NotRegistered(address user)` - User not registered
- `InvalidAmount()` - Amount is 0
- ERC20 transfer failures

---

#### `withdraw(uint256 amount)`

Withdraw available tokens from vault.

```solidity
function withdraw(uint256 amount) external nonReentrant whenNotPaused
```

**Parameters**:
- `amount` - Amount to withdraw

**Requirements**:
- Caller must have sufficient available balance
- Amount must be > 0
- Contract must not be paused
- Emits `WithdrawalMade(address user, uint256 amount)`

**Reverts**:
- `InsufficientBalance()` - Not enough available balance
- `InvalidAmount()` - Amount is 0

---

#### `createGoal(uint256 targetAmount, uint256 targetDate)`

Create a savings goal.

```solidity
function createGoal(uint256 targetAmount, uint256 targetDate) external returns (uint256 goalId)
```

**Parameters**:
- `targetAmount` - Target amount for the goal
- `targetDate` - Target completion timestamp

**Requirements**:
- User must be registered
- Target amount must be > 0
- Target date must be in the future
- Emits `GoalCreated(address user, uint256 goalId, uint256 targetAmount, uint256 targetDate)`

**Returns**:
- `goalId` - Unique identifier for the created goal

**Reverts**:
- `InvalidAmount()` - Target amount is 0
- `InvalidDate()` - Target date in the past

---

#### `contributeToGoal(uint256 goalId, uint256 amount)`

Contribute to an existing goal.

```solidity
function contributeToGoal(uint256 goalId, uint256 amount) external nonReentrant
```

**Parameters**:
- `goalId` - Goal to contribute to
- `amount` - Amount to contribute

**Requirements**:
- Goal must exist and belong to caller
- Amount must be > 0
- User must have sufficient available balance
- Goal must not already be completed
- Emits `GoalCompleted(address user, uint256 goalId)` if goal reaches target

**Reverts**:
- `GoalNotFound()` - Invalid goal ID
- `NotGoalOwner()` - Goal belongs to different user
- `InsufficientBalance()` - Not enough available balance

---

#### `lockFunds(uint256 amount, uint256 duration)`

Lock funds for a specified duration.

```solidity
function lockFunds(uint256 amount, uint256 duration) external nonReentrant returns (uint256 lockId)
```

**Parameters**:
- `amount` - Amount to lock
- `duration` - Lock duration in seconds

**Requirements**:
- Amount must be > 0
- Duration must be within MIN_LOCK_DURATION and MAX_LOCK_DURATION
- User must have sufficient available balance
- Emits `FundsLocked(address user, uint256 lockId, uint256 amount, uint256 expiry)`

**Returns**:
- `lockId` - Unique identifier for the lock

**Reverts**:
- `InvalidAmount()` - Amount is 0
- `InvalidDuration()` - Duration out of range
- `InsufficientBalance()` - Not enough available balance

---

#### `withdrawLocked(uint256 lockId)`

Withdraw from an expired time lock.

```solidity
function withdrawLocked(uint256 lockId) external nonReentrant
```

**Parameters**:
- `lockId` - Lock to withdraw from

**Requirements**:
- Lock must exist and belong to caller
- Lock must be expired (block.timestamp >= expiry)
- Emits `LockReleased(address user, uint256 lockId, uint256 amount)`

**Reverts**:
- `LockNotFound()` - Invalid lock ID
- `NotLockOwner()` - Lock belongs to different user
- `LockNotExpired()` - Lock still active

---

### View Functions

#### `balanceOf(address user) → uint256`

Get user's total vault balance (including locked funds).

#### `availableBalance(address user) → uint256`

Get user's available balance (excludes locked funds and goal contributions).

#### `portfolioValue(address user) → uint256`

Get user's total portfolio value across all vault features.

#### `getGoal(uint256 goalId) → (address owner, uint256 targetAmount, uint256 currentAmount, uint256 targetDate, bool completed)`

Get goal details.

#### `getUserGoals(address user) → uint256[]`

Get array of goal IDs for a user.

#### `getLock(uint256 lockId) → (address owner, uint256 amount, uint256 expiry)`

Get time lock details.

#### `getUserLocks(address user) → uint256[]`

Get array of lock IDs for a user.

#### `getLockedTotal(address user) → uint256`

Get total amount in active time locks for a user.

---

### Events

```solidity
event DepositMade(address indexed user, uint256 amount);
event WithdrawalMade(address indexed user, uint256 amount);
event GoalCreated(address indexed user, uint256 indexed goalId, uint256 targetAmount, uint256 targetDate);
event GoalCompleted(address indexed user, uint256 indexed goalId);
event FundsLocked(address indexed user, uint256 indexed lockId, uint256 amount, uint256 expiry);
event LockReleased(address indexed user, uint256 indexed lockId, uint256 amount);
```

---

## 🏛️ CommunityTreasury Contract

**Purpose**: Investment circles, community pools, and collaborative financial decisions.

**Address**: `getContractAddress(84532, 'CommunityTreasury')`

### Public Functions

#### `createCircle(uint256 maxMembers, uint8 threshold)`

Create a new investment circle.

```solidity
function createCircle(uint256 maxMembers, uint8 threshold) external returns (uint256 poolId)
```

**Parameters**:
- `maxMembers` - Maximum number of members (≥2)
- `threshold` - Vote threshold percentage (1-100)

**Requirements**:
- maxMembers must be ≥ 2
- threshold must be 1-100
- Caller is automatically added as first member
- Emits `PoolCreated(address creator, uint256 poolId, uint256 maxMembers, uint8 threshold)`

**Returns**:
- `poolId` - Unique identifier for the circle

**Reverts**:
- `InvalidCircleParams()` - Invalid parameters

---

#### `joinCircle(uint256 poolId)`

Join an existing circle.

```solidity
function joinCircle(uint256 poolId) external
```

**Parameters**:
- `poolId` - Circle to join

**Requirements**:
- Circle must exist
- Circle must not be full
- Caller must not already be a member
- Emits `MemberJoined(uint256 poolId, address member)`

**Reverts**:
- `PoolNotFound()` - Invalid pool ID
- `PoolFull()` - Circle at maximum capacity
- `AlreadyMember()` - User already in circle

---

#### `contribute(uint256 poolId, uint256 amount)`

Contribute tokens to a circle.

```solidity
function contribute(uint256 poolId, uint256 amount) external nonReentrant
```

**Parameters**:
- `poolId` - Circle to contribute to
- `amount` - Amount to contribute

**Requirements**:
- Caller must be circle member
- Amount must be > 0
- User must have sufficient token balance and approval
- Emits `ContributionMade(address member, uint256 poolId, uint256 amount)`

**Reverts**:
- `NotMember()` - Caller not a circle member
- `InvalidAmount()` - Amount is 0
- ERC20 transfer failures

---

#### `proposeAction(uint256 poolId, address recipient, uint256 amount)`

Propose a treasury action (spending proposal).

```solidity
function proposeAction(uint256 poolId, address recipient, uint256 amount) external returns (uint256 actionId)
```

**Parameters**:
- `poolId` - Circle proposing the action
- `recipient` - Address to receive funds
- `amount` - Amount to send

**Requirements**:
- Caller must be circle member
- Circle must have sufficient balance
- Amount must be > 0
- Creates new action for voting

**Returns**:
- `actionId` - Unique identifier for the action

**Reverts**:
- `NotMember()` - Caller not a member
- `InsufficientBalance()` - Circle lacks funds

---

#### `vote(uint256 actionId)`

Vote on a treasury action.

```solidity
function vote(uint256 actionId) external
```

**Parameters**:
- `actionId` - Action to vote on

**Requirements**:
- Caller must be member of the action's circle
- Caller must not have already voted
- Action must still be active
- Emits `VoteCast(address voter, uint256 actionId)`
- Auto-executes if threshold reached: `ActionExecuted(uint256 actionId, address recipient, uint256 amount)`

**Reverts**:
- `ActionNotFound()` - Invalid action ID
- `NotMember()` - Caller not a member
- `AlreadyVoted()` - Caller already voted

---

#### `contributeToPool(uint256 poolId, uint256 amount)`

Contribute to investment pool (alternative to circles).

```solidity
function contributeToPool(uint256 poolId, uint256 amount) external nonReentrant
```

**Parameters**:
- `poolId` - Pool to contribute to
- `amount` - Contribution amount

**Requirements**:
- Pool must exist
- Amount must be > 0
- Updates ownership share proportionally
- Records timestamped contribution history

---

### View Functions

#### `getCircle(uint256 poolId) → (address creator, uint256 maxMembers, uint8 threshold, uint256 memberCount, uint256 balance)`

Get circle details.

#### `isCircleMember(uint256 poolId, address user) → bool`

Check if user is circle member.

#### `getCircleMembers(uint256 poolId) → address[]`

Get array of circle members.

#### `getAction(uint256 actionId) → (uint256 poolId, address recipient, uint256 amount, uint256 votes, bool executed)`

Get action details.

#### `hasVoted(uint256 actionId, address voter) → bool`

Check if user has voted on action.

#### `ownershipShare(uint256 poolId, address user) → uint256`

Get user's ownership percentage in pool (parts per million).

#### `getContributionHistory(uint256 poolId, address user) → (uint256[] amounts, uint256[] timestamps)`

Get user's contribution history for a pool.

---

### Events

```solidity
event PoolCreated(address indexed creator, uint256 indexed poolId, uint256 maxMembers, uint8 threshold);
event MemberJoined(uint256 indexed poolId, address indexed member);
event ContributionMade(address indexed member, uint256 indexed poolId, uint256 amount);
event VoteCast(address indexed voter, uint256 indexed actionId);
event ActionExecuted(uint256 indexed actionId, address indexed recipient, uint256 amount);
```

---

## 🎓 Education Contract

**Purpose**: Certificate issuance, badge awards, and achievement tracking with reputation rewards.

**Address**: `getContractAddress(84532, 'Education')`

### Public Functions

#### `issueCertificate(address user, bytes32 courseId, string memory metadataHash)`

Issue a certificate to a user (ISSUER_ROLE only).

```solidity
function issueCertificate(address user, bytes32 courseId, string memory metadataHash) external onlyRole(ISSUER_ROLE) returns (uint256 certificateId)
```

**Parameters**:
- `user` - Recipient address
- `courseId` - Unique course identifier
- `metadataHash` - IPFS hash of certificate metadata

**Requirements**:
- Caller must have ISSUER_ROLE
- User must be registered in Registry
- Metadata hash must not be empty
- Prevents duplicate certificates for same user+course
- Emits `CertificateIssued(address user, uint256 certificateId, bytes32 courseId)`

**Returns**:
- `certificateId` - Unique certificate ID

**Reverts**:
- `NotRegistered(address user)` - User not registered
- `EmptyMetadataHash()` - Empty metadata hash
- `CertificateExists()` - Duplicate certificate

---

#### `awardBadge(address user, bytes32 badgeId)`

Award a badge to a user (ISSUER_ROLE only).

```solidity
function awardBadge(address user, bytes32 badgeId) external onlyRole(ISSUER_ROLE)
```

**Parameters**:
- `user` - Recipient address
- `badgeId` - Unique badge identifier

**Requirements**:
- Caller must have ISSUER_ROLE
- User must be registered
- Prevents duplicate badges
- Emits `BadgeAwarded(address user, bytes32 badgeId)`

**Reverts**:
- `NotRegistered(address user)` - User not registered
- `BadgeExists()` - User already has badge

---

#### `recordAchievement(address user, bytes32 achievementId, uint256 reputationAmount)`

Record achievement and award reputation (ISSUER_ROLE only).

```solidity
function recordAchievement(address user, bytes32 achievementId, uint256 reputationAmount) external onlyRole(ISSUER_ROLE)
```

**Parameters**:
- `user` - User achieving the milestone
- `achievementId` - Unique achievement identifier  
- `reputationAmount` - Reputation points to award

**Requirements**:
- Caller must have ISSUER_ROLE
- User must be registered
- Reputation amount must be > 0
- Calls Registry.increaseReputation() automatically
- Emits `AchievementRecorded(address user, bytes32 achievementId, uint256 reputationAmount)`

**Reverts**:
- `NotRegistered(address user)` - User not registered
- `InvalidAmount()` - Reputation amount is 0

---

### View Functions

#### `getCertificate(uint256 certificateId) → (address user, bytes32 courseId, string metadataHash, uint256 issuedAt)`

Get certificate details.

#### `getUserCertificates(address user) → uint256[]`

Get array of certificate IDs for user.

#### `hasCertificate(address user, bytes32 courseId) → bool`

Check if user has certificate for specific course.

#### `hasBadge(address user, bytes32 badgeId) → bool`

Check if user has specific badge.

#### `getUserBadges(address user) → bytes32[]`

Get array of badge IDs for user.

#### `hasAchievement(address user, bytes32 achievementId) → bool`

Check if user has specific achievement.

#### `getUserAchievements(address user) → bytes32[]`

Get array of achievement IDs for user.

---

### Events

```solidity
event CertificateIssued(address indexed user, uint256 indexed certificateId, bytes32 indexed courseId);
event BadgeAwarded(address indexed user, bytes32 indexed badgeId);
event AchievementRecorded(address indexed user, bytes32 indexed achievementId, uint256 reputationAmount);
```

---

## 🏛️ Governance Contract  

**Purpose**: Decentralized governance with reputation-weighted voting and proposal execution.

**Address**: `getContractAddress(84532, 'Governance')`

### Public Functions

#### `propose(bytes memory action, uint256 votingPeriod)`

Create a governance proposal.

```solidity
function propose(bytes memory action, uint256 votingPeriod) external returns (uint256 proposalId)
```

**Parameters**:
- `action` - Encoded function call to execute if passed
- `votingPeriod` - Duration of voting in seconds

**Requirements**:
- Caller must have voting power (reputation > 0)
- Voting period must be reasonable (1 hour to 30 days)
- Emits `ProposalCreated(address proposer, uint256 proposalId, uint256 votingEnds)`

**Returns**:
- `proposalId` - Unique proposal identifier

**Reverts**:
- `NoVotingPower(address user)` - Caller has no reputation
- `InvalidVotingPeriod()` - Invalid voting period

---

#### `castVote(uint256 proposalId, bool support)`

Vote on an active proposal.

```solidity
function castVote(uint256 proposalId, bool support) external
```

**Parameters**:
- `proposalId` - Proposal to vote on
- `support` - true for yes, false for no

**Requirements**:
- Proposal must be active (within voting period)
- Caller must have voting power
- One vote per address per proposal
- Vote weight = caller's reputation score
- Emits `VoteCast(address voter, uint256 proposalId, uint256 weight, bool support)`

**Reverts**:
- `ProposalNotFound()` - Invalid proposal ID
- `ProposalNotActive()` - Voting period ended
- `AlreadyVoted()` - User already voted
- `NoVotingPower(address user)` - No reputation

---

#### `finalize(uint256 proposalId)`

Finalize proposal after voting period ends.

```solidity
function finalize(uint256 proposalId) external
```

**Parameters**:
- `proposalId` - Proposal to finalize

**Requirements**:
- Voting period must have ended
- Proposal must not already be finalized
- Determines outcome based on vote counts
- Emits `ProposalFinalized(uint256 proposalId, uint8 result)`

**Reverts**:
- `ProposalNotFound()` - Invalid proposal ID
- `VotingNotEnded()` - Still in voting period
- `AlreadyFinalized()` - Already processed

---

#### `executeTreasury(string memory description)`

Execute treasury action (TREASURY_ROLE only).

```solidity
function executeTreasury(string memory description) external onlyRole(TREASURY_ROLE)
```

**Parameters**:
- `description` - Description of treasury action

**Requirements**:
- Caller must have TREASURY_ROLE (typically CommunityTreasury contract)
- Used for executing passed treasury-related proposals

---

### View Functions

#### `votingPowerOf(address user) → uint256`

Get voting power (reputation) of user.

#### `getProposal(uint256 proposalId) → (address proposer, bytes action, uint256 votingEnds, uint256 yesVotes, uint256 noVotes, bool finalized)`

Get complete proposal details.

#### `hasVoted(uint256 proposalId, address voter) → bool`

Check if user has voted on proposal.

#### `outcomeOf(uint256 proposalId) → ProposalState`

Get proposal outcome (Pending, Active, Passed, Failed).

#### `getActiveProposals() → uint256[]`

Get array of currently active proposal IDs.

---

### Events

```solidity
event ProposalCreated(address indexed proposer, uint256 indexed proposalId, uint256 votingEnds);
event VoteCast(address indexed voter, uint256 indexed proposalId, uint256 weight, bool support);
event ProposalFinalized(uint256 indexed proposalId, uint8 result);
```

---

## 🔗 Contract Interactions

### Cross-Contract Dependencies

1. **Education → Registry**: Calls `increaseReputation()` when recording achievements
2. **All Contracts → Registry**: Check user registration status
3. **Governance → CommunityTreasury**: Treasury role for proposal execution
4. **Frontend → All**: Read financial data directly from contracts

### Integration Patterns

```solidity
// Example: Check registration before allowing actions
modifier onlyRegistered() {
    require(registry.isRegistered(msg.sender), "Not registered");
    _;
}

// Example: Cross-contract reputation increase
function recordAchievement(address user, bytes32 achievementId, uint256 reputationAmount) external {
    // ... validation ...
    registry.increaseReputation(user, reputationAmount);
    emit AchievementRecorded(user, achievementId, reputationAmount);
}
```

---

## ⚡ Gas Optimization

### Efficient Data Storage

- Packed structs to minimize storage slots
- uint256 for most values (gas-optimized)
- Mappings over arrays for O(1) lookups
- Events for historical data rather than storage

### Function Optimizations

- `nonReentrant` only on value-transfer functions
- Batch operations where possible
- Early validation to avoid expensive operations
- View functions for complex calculations

---

## 🔒 Security Features

### Access Control

- Role-based permissions with OpenZeppelin AccessControl
- Multi-signature admin operations where appropriate
- Pausable functionality for emergency stops

### Protection Mechanisms

- Reentrancy guards on all value transfers
- Overflow protection with Solidity 0.8.24
- Input validation on all user inputs
- Time-based locks with expiration checks

### Upgrade Safety

- UUPS proxy pattern with admin-controlled upgrades
- Storage layout preservation between upgrades
- Gap variables for future storage additions

---

## 🧪 Testing

Each contract has comprehensive test coverage:

- **Unit Tests**: Individual function testing
- **Integration Tests**: Cross-contract interactions  
- **Property Tests**: Invariant and correctness properties
- **Gas Tests**: Performance optimization validation

### Key Test Scenarios

1. **Happy Path**: Normal user interactions
2. **Edge Cases**: Boundary conditions and limits
3. **Access Control**: Role-based permission validation
4. **Reentrancy**: Attack vector protection
5. **Upgrade**: Proxy upgrade state preservation

---

## 🚀 Deployment

All contracts deployed via UUPS proxies on Base Sepolia:

```bash
# Deploy all contracts with role configuration
forge script script/DeployBaseSepolia.s.sol:DeployBaseSepolia \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

**Post-Deployment**:
1. Role assignment and cross-contract permissions
2. Contract address registration in shared package
3. Frontend integration with generated ABIs
4. Verification on BaseScan

---

## 📞 Support

- **Contract Issues**: Open GitHub issue with reproduction
- **Integration Help**: developers@bonitah.finance  
- **Security Concerns**: security@bonitah.finance
- **BaseScan**: View contracts on https://sepolia.basescan.org

---

*Built with Foundry and OpenZeppelin • Deployed on Base Sepolia*