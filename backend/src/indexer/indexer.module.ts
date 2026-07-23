import { Module } from '@nestjs/common';

import { IndexerService } from './indexer.service.js';

/**
 * Event_Indexer module that reads emitted contract events from Base Sepolia and
 * caches them for query and analytics (Req 12, 13).
 *
 * Runs a background worker that polls finalized blocks, detects reorganizations,
 * and maintains a gapless event cache with full provenance for fast transaction
 * history and analytics.
 */
@Module({
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}
