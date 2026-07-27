/**
 * Shared TypeScript types for BFN, consumed by both the frontend and backend so
 * the two layers agree on a single typed contract.
 *
 * Financial values that originate on-chain are represented as `bigint` (wei-scale
 * token units) to preserve precision; when they cross the REST boundary they are
 * serialized as decimal strings (see ./schemas.ts). The backend never stores these
 * as an authoritative source (Req 1.3) — on-chain state is the source of truth.
 */
/** All BFN contract names as a runtime-iterable list. */
export const CONTRACT_NAMES = [
    'Registry',
    'SavingsVault',
    'CommunityTreasury',
    'Education',
    'Governance',
];
export const ROLES = ['USER', 'VERIFIER', 'ADMIN'];
/** Least-privilege default assigned to newly authenticated wallets (Req 2.10). */
export const DEFAULT_ROLE = 'USER';
//# sourceMappingURL=types.js.map