/**
 * ChainRead module types for cached financial values with provenance (Req 1.4).
 */

import type { Address } from 'viem';
import type { ContractName, Provenance } from '@bfn/shared';

/** A cached read value entry with provenance metadata. */
export interface CachedReadEntry {
  contractAddress: Address;
  functionName: string;
  args: readonly unknown[];
  value: string;
  blockNumber: bigint;
  fetchedAt: Date;
}

/** Parameters for reading a contract function. */
export interface ReadParams {
  contract: ContractName;
  functionName: string;
  args?: readonly unknown[];
}

/** The result of a read operation with provenance. */
export interface ReadResult {
  value: string;
  provenance: Provenance;
}

/** Cache key generator for read operations. */
export function generateCacheKey(contract: ContractName, functionName: string, args?: readonly unknown[]): string {
  // Handle undefined vs empty array distinction
  let argsHash: string;
  if (args === undefined) {
    argsHash = 'undefined';
  } else if (args.length === 0) {
    argsHash = 'empty';
  } else {
    argsHash = JSON.stringify(args);
  }
  return `bfn:read:${contract}:${functionName}:${argsHash}`;
}

/** The staleness threshold for cached values (30 seconds per Req 1.4, 1.5). */
export const STALENESS_THRESHOLD_MS = 30 * 1000;

/** Check if a cached entry is stale based on fetchedAt timestamp. */
export function isStale(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() > STALENESS_THRESHOLD_MS;
}