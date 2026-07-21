/**
 * @bfn/shared — the single typed contract between BFN layers.
 *
 * Re-exports:
 *  - networks:  Base Sepolia (84532) chain constants and guards (Req 1.1)
 *  - types:     shared domain types and on-chain entity shapes
 *  - addresses: per-network deployed-address registry (Req 17.1)
 *  - abis:      typed ABI placeholders (populated post contract build)
 *  - schemas:   zod schemas for the REST API request/response contracts (Req 14.3)
 */

export * from './networks.js';
export * from './types.js';
export * from './addresses.js';
export * from './abis.js';
export * from './schemas.js';
