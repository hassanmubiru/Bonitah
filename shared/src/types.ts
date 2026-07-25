/**
 * Shared TypeScript types for BFN, consumed by both the frontend and backend so
 * the two layers agree on a single typed contract.
 *
 * Financial values that originate on-chain are represented as `bigint` (wei-scale
 * token units) to preserve precision; when they cross the REST boundary they are
 * serialized as decimal strings (see ./schemas.ts). The backend never stores these
 * as an authoritative source (Req 1.3) — on-chain state is the source of truth.
 */

import type { Address, Hash, Hex } from 'viem';

/** The five BFN smart contracts deployed to Base Sepolia. */
export type ContractName =
  'Registry' | 'SavingsVault' | 'CommunityTreasury' | 'Education' | 'Governance';

/** All BFN contract names as a runtime-iterable list. */
export const CONTRACT_NAMES = [
  'Registry',
  'SavingsVault',
  'CommunityTreasury',
  'Education',
  'Governance',
] as const satisfies readonly ContractName[];

/**
 * Off-chain authorization roles (Req 2.10, 14.9). Mirrors the Prisma `Role` enum.
 * New wallets default to the least-privilege `USER` role.
 */
export type Role = 'USER' | 'VERIFIER' | 'ADMIN';

export const ROLES = ['USER', 'VERIFIER', 'ADMIN'] as const satisfies readonly Role[];

/** Least-privilege default assigned to newly authenticated wallets (Req 2.10). */
export const DEFAULT_ROLE: Role = 'USER';

// ---------------------------------------------------------------------------
// On-chain entity shapes (mirrors of contract structs in design.md)
// These are read from contracts and are never treated as off-chain truth.
// ---------------------------------------------------------------------------

/** Registry.sol `UserProfile` (Req 3). */
export interface UserProfile {
  registered: boolean;
  verified: boolean;
  reputationScore: bigint;
  ipfsProfileHash: string;
  registeredAt: bigint;
}

/** SavingsVault.sol `Goal` (Req 5). */
export interface Goal {
  id: bigint;
  targetAmount: bigint;
  targetDate: bigint;
  savedAmount: bigint;
  completed: boolean;
}

/** SavingsVault.sol `Lock` (Req 5). */
export interface Lock {
  amount: bigint;
  expiry: bigint;
  released: boolean;
}

/** A user's aggregated on-chain financial position (Req 5.6, 11.1). */
export interface PortfolioSnapshot {
  depositedBalance: bigint;
  lockedTotal: bigint;
  availableBalance: bigint;
  portfolioValue: bigint;
}

/** CommunityTreasury.sol `Circle` (Req 6). */
export interface Circle {
  creator: Address;
  maxMembers: bigint;
  approvalThreshold: number; // whole-number percent 1..100
  memberCount: bigint;
  treasuryBalance: bigint;
  open: boolean;
}

/** A single timestamped contribution record (Req 6.6, 7.3). */
export interface Contribution {
  amount: bigint;
  timestamp: bigint;
}

/** Governance proposal lifecycle state (Req 9). */
export type ProposalState = 'Active' | 'Passed' | 'Rejected' | 'Executed';

/** Governance.sol `Proposal` (Req 9). */
export interface Proposal {
  id: bigint;
  proposer: Address;
  votingEnds: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  quorum: bigint;
  state: ProposalState;
}

/** Education.sol `Certificate` (Req 8). */
export interface Certificate {
  id: bigint;
  courseId: Hex;
  ipfsMetadataHash: string;
  issuedAt: bigint;
}

// ---------------------------------------------------------------------------
// Provenance envelopes (Req 1.4, 12.2)
// ---------------------------------------------------------------------------

/**
 * Provenance metadata attached to any cached financial value or indexed event so
 * the origin on-chain source is always identifiable (Req 1.4, 12.2).
 */
export interface Provenance {
  contractAddress: Address;
  blockNumber: bigint;
  fetchedAt: string; // ISO-8601 timestamp
}

/** A cached financial value carrying its source provenance (Req 1.4). */
export interface ProvenancedValue<T = string> {
  value: T;
  provenance: Provenance;
}

/** A decoded, indexed blockchain event with full provenance (Req 12.2). */
export interface IndexedEvent {
  contractAddress: Address;
  eventName: string;
  walletAddress: Address | null;
  transactionHash: Hash;
  blockNumber: bigint;
  blockHash: Hash;
  logIndex: number;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// AI Assistant types (Req 10.1, 10.4, 10.7)
export interface AIAction {
  type: ActionType;
  title: string;
  description: string;
  amount?: string;
  targetAddress?: string;
  requiresSignature: boolean;
  estimatedGas?: string;
}

export type ActionType = 
  | 'deposit_savings'
  | 'create_goal' 
  | 'join_circle'
  | 'invest_pool'
  | 'withdraw_funds'
  | 'view_portfolio';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  actions?: AIAction[];
}

export interface ConversationSummary {
  id: string;
  createdAt: Date;
  messageCount: number;
  lastMessage: string | null;
  lastMessageAt: Date;
}

// Re-exported viem primitives for downstream convenience.
// ---------------------------------------------------------------------------
export type { Address, Hash, Hex };
