/**
 * Typed ABI placeholders for the five BFN contracts.
 *
 * These are intentionally minimal PLACEHOLDERS containing only the stable
 * state-change events mandated by Requirement 13. After the Foundry build/deploy
 * (tasks 2, 8, 9) the full generated ABIs (functions, errors, and remaining events)
 * are emitted here, giving the frontend (wagmi/viem) and backend (viem) fully typed,
 * autocompleted contract access.
 *
 * Each ABI is declared `as const` and checked with `satisfies Abi` so abitype infers
 * precise argument/return types today and after regeneration. Do not hand-edit the
 * generated portions once the codegen pipeline is wired.
 */

import type { Abi } from 'abitype';

import type { ContractName } from './types.js';

/** Registry.sol — user registration, profile, verification, reputation (Req 3, 13.1). */
export const registryAbi = [
  {
    type: 'event',
    name: 'UserRegistered',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProfileUpdated',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'ipfsProfileHash', type: 'string', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'UserVerified',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'verifier', type: 'address', indexed: true },
    ],
    anonymous: false,
  },
] as const satisfies Abi;

/** SavingsVault.sol — deposits, withdrawals, goals, locks (Req 4, 5, 13.2–13.5). */
export const savingsVaultAbi = [
  {
    type: 'event',
    name: 'DepositMade',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WithdrawalMade',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GoalCreated',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'goalId', type: 'uint256', indexed: true },
      { name: 'targetAmount', type: 'uint256', indexed: false },
      { name: 'targetDate', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GoalCompleted',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'goalId', type: 'uint256', indexed: true },
    ],
    anonymous: false,
  },
] as const satisfies Abi;

/** CommunityTreasury.sol — circles, contributions, votes, pools (Req 6, 7, 13.6–13.8). */
export const communityTreasuryAbi = [
  {
    type: 'event',
    name: 'PoolCreated',
    inputs: [
      { name: 'creator', type: 'address', indexed: true },
      { name: 'poolId', type: 'uint256', indexed: true },
      { name: 'maxMembers', type: 'uint256', indexed: false },
      { name: 'approvalThreshold', type: 'uint8', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ContributionMade',
    inputs: [
      { name: 'contributor', type: 'address', indexed: true },
      { name: 'poolId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VoteCast',
    inputs: [
      { name: 'voter', type: 'address', indexed: true },
      { name: 'actionId', type: 'uint256', indexed: true },
    ],
    anonymous: false,
  },
] as const satisfies Abi;

/** Education.sol — certificates, badges, achievements (Req 8, 13.9). */
export const educationAbi = [
  {
    type: 'event',
    name: 'CertificateIssued',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'certificateId', type: 'uint256', indexed: true },
      { name: 'courseId', type: 'bytes32', indexed: true },
    ],
    anonymous: false,
  },
] as const satisfies Abi;

/** Governance.sol — proposals, weighted voting, treasury ops (Req 9, 13.8). */
export const governanceAbi = [
  {
    type: 'event',
    name: 'ProposalCreated',
    inputs: [
      { name: 'proposer', type: 'address', indexed: true },
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'votingEnds', type: 'uint256', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VoteCast',
    inputs: [
      { name: 'voter', type: 'address', indexed: true },
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'weight', type: 'uint256', indexed: false },
      { name: 'support', type: 'bool', indexed: false },
    ],
    anonymous: false,
  },
] as const satisfies Abi;

/** Registry of every contract ABI keyed by contract name. */
export const CONTRACT_ABIS = {
  Registry: registryAbi,
  SavingsVault: savingsVaultAbi,
  CommunityTreasury: communityTreasuryAbi,
  Education: educationAbi,
  Governance: governanceAbi,
} as const satisfies Record<ContractName, Abi>;

/** Resolve the ABI for a given contract name. */
export function getContractAbi(name: ContractName): Abi {
  return CONTRACT_ABIS[name];
}
