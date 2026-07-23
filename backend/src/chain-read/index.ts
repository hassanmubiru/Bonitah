/**
 * Public surface of the ChainRead module.
 * 
 * Exports the module and service for use by other feature modules (AI, analytics, etc.)
 * that need to read cached financial values with provenance.
 */

export { ChainReadModule } from './chain-read.module';
export { ChainReadService } from './chain-read.service';
export type { ReadParams, ReadResult, CachedReadEntry } from './chain-read.types';
export { generateCacheKey, isStale, STALENESS_THRESHOLD_MS } from './chain-read.types';