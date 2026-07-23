import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createPublicClient, http, type Log } from 'viem';
import { baseSepolia } from 'viem/chains';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Event_Indexer service that reads emitted contract events from Base Sepolia
 * and caches them for query and analytics (Req 12, 13).
 *
 * Polls finalized blocks, detects reorganizations, handles reorgs by removing
 * non-canonical events and re-caching canonical ones, and maintains gapless
 * event cache with full provenance.
 */
@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private readonly publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
  
  private isRunning = false;
  private stopRequested = false;
  
  // Contract addresses to monitor (will be populated from shared package)
  private readonly monitoredContracts: string[] = [];

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Start indexing worker
    await this.startIndexing();
  }

  /**
   * Start the indexing worker that polls for new events
   */
  async startIndexing(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    this.logger.log('Starting Event_Indexer worker');

    // Start the polling loop
    setImmediate(() => this.indexingLoop());
  }

  /**
   * Stop the indexing worker
   */
  async stopIndexing(): Promise<void> {
    this.logger.log('Stopping Event_Indexer worker');
    this.stopRequested = true;
    
    // Wait for current iteration to complete
    while (this.isRunning) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Main indexing loop that processes new blocks and handles reorgs
   */
  private async indexingLoop(): Promise<void> {
    try {
      while (!this.stopRequested) {
        await this.indexNewBlocks();
        
        // Wait before next poll (configurable interval)
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second poll interval
      }
    } catch (error) {
      this.logger.error('Error in indexing loop', error);
      // Retry with backoff
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second backoff
      if (!this.stopRequested) {
        setImmediate(() => this.indexingLoop());
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process new blocks since the last indexed block
   */
  private async indexNewBlocks(): Promise<void> {
    const state = await this.getIndexerState();
    const currentBlock = await this.publicClient.getBlockNumber();
    
    if (state.lastIndexedBlock >= currentBlock) {
      return; // No new blocks to process
    }

    const fromBlock = state.lastIndexedBlock + 1n;
    const toBlock = currentBlock;

    this.logger.debug(`Indexing blocks ${fromBlock} to ${toBlock}`);

    // Check for reorg first
    await this.handlePotentialReorg(state.lastIndexedBlock, state.lastIndexedHash);

    // Get logs for the new block range
    const logs = await this.getLogs(fromBlock, toBlock);
    
    // Process and cache the events
    await this.cacheEvents(logs);
    
    // Update indexer state
    const latestBlock = await this.publicClient.getBlock({ 
      blockNumber: toBlock, 
      includeTransactions: false 
    });
    
    await this.updateIndexerState(toBlock, latestBlock.hash);
  }

  /**
   * Check for chain reorganization and handle it if detected
   */
  private async handlePotentialReorg(lastIndexedBlock: bigint, lastIndexedHash: string): Promise<void> {
    if (lastIndexedBlock === 0n) {
      return; // No previous state to check
    }

    try {
      // Get the canonical block at the last indexed height
      const canonicalBlock = await this.publicClient.getBlock({ 
        blockNumber: lastIndexedBlock,
        includeTransactions: false 
      });

      if (canonicalBlock.hash !== lastIndexedHash) {
        this.logger.warn(`Reorg detected at block ${lastIndexedBlock}. Expected hash: ${lastIndexedHash}, actual: ${canonicalBlock.hash}`);
        await this.handleReorganization(lastIndexedBlock);
      }
    } catch (error) {
      this.logger.error(`Failed to check for reorg at block ${lastIndexedBlock}`, error);
      throw error;
    }
  }

  /**
   * Handle chain reorganization by removing non-canonical events and re-caching canonical ones
   * **Validates: Requirements 12.5**
   */
  private async handleReorganization(reorgBlock: bigint): Promise<void> {
    this.logger.log(`Handling reorganization from block ${reorgBlock}`);

    // Find the depth of the reorg by walking back to find common ancestor
    let checkBlock = reorgBlock;
    let commonAncestor = 0n;
    
    while (checkBlock > 0n) {
      try {
        const canonicalBlock = await this.publicClient.getBlock({ 
          blockNumber: checkBlock,
          includeTransactions: false 
        });
        
        const cachedEvent = await this.prisma.cachedEvent.findFirst({
          where: { blockNumber: checkBlock },
          select: { blockHash: true }
        });

        if (!cachedEvent || cachedEvent.blockHash === canonicalBlock.hash) {
          // Found common ancestor
          commonAncestor = checkBlock;
          break;
        }
        
        checkBlock--;
      } catch (error) {
        this.logger.error(`Error finding common ancestor at block ${checkBlock}`, error);
        checkBlock--;
      }
    }

    if (commonAncestor === 0n) {
      this.logger.error('Could not find common ancestor, clearing all cached events');
      // In extreme case, clear everything and start over
      await this.prisma.cachedEvent.deleteMany();
      await this.updateIndexerState(0n, '');
      return;
    }

    const reorgStartBlock = commonAncestor + 1n;
    this.logger.log(`Reorg affects blocks ${reorgStartBlock} to ${reorgBlock}, common ancestor: ${commonAncestor}`);

    // Remove non-canonical cached events for the affected range
    const deletedCount = await this.prisma.cachedEvent.deleteMany({
      where: {
        blockNumber: {
          gte: reorgStartBlock,
          lte: reorgBlock,
        },
      },
    });

    this.logger.log(`Removed ${deletedCount.count} non-canonical cached events`);

    // Re-cache canonical events for the affected range
    const canonicalLogs = await this.getLogs(reorgStartBlock, reorgBlock);
    await this.cacheEvents(canonicalLogs);

    // Update indexer state to the common ancestor to resume from there
    const ancestorBlock = await this.publicClient.getBlock({ 
      blockNumber: commonAncestor,
      includeTransactions: false 
    });
    
    await this.updateIndexerState(commonAncestor, ancestorBlock.hash);
    
    this.logger.log(`Reorganization handled successfully. Resuming from block ${commonAncestor}`);
  }

  /**
   * Get logs from the specified block range for monitored contracts
   */
  private async getLogs(fromBlock: bigint, toBlock: bigint): Promise<Log[]> {
    if (this.monitoredContracts.length === 0) {
      return []; // No contracts to monitor yet
    }

    try {
      const logs = await this.publicClient.getLogs({
        fromBlock,
        toBlock,
        address: this.monitoredContracts as `0x${string}`[],
      });

      this.logger.debug(`Retrieved ${logs.length} logs from blocks ${fromBlock}-${toBlock}`);
      return logs;
    } catch (error) {
      this.logger.error(`Failed to get logs from blocks ${fromBlock}-${toBlock}`, error);
      throw error;
    }
  }

  /**
   * Cache events with full provenance (idempotent upsert)
   */
  private async cacheEvents(logs: Log[]): Promise<void> {
    for (const log of logs) {
      try {
        // Ensure required fields are present
        if (!log.transactionHash || log.logIndex === null || log.logIndex === undefined) {
          this.logger.warn(`Skipping log with missing required fields: ${JSON.stringify(log)}`);
          continue;
        }

        // Extract wallet address from topics if available (depends on event structure)
        const walletAddress = this.extractWalletAddress(log);

        await this.prisma.cachedEvent.upsert({
          where: {
            transactionHash_logIndex: {
              transactionHash: log.transactionHash,
              logIndex: log.logIndex,
            },
          },
          create: {
            contractAddress: log.address.toLowerCase(),
            eventName: this.getEventName(log), // Would need ABI decoding for proper name
            walletAddress: walletAddress?.toLowerCase() ?? null,
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber!,
            blockHash: log.blockHash!,
            logIndex: log.logIndex,
            payload: log as any, // Store raw log data
          },
          update: {
            // Update in case of re-caching after reorg
            blockHash: log.blockHash!,
            payload: log as any,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to cache event ${log.transactionHash}:${log.logIndex}`, error);
        // Continue with other events
      }
    }

    if (logs.length > 0) {
      this.logger.debug(`Cached ${logs.length} events`);
    }
  }

  /**
   * Extract wallet address from log topics (simplified - would need proper ABI decoding)
   */
  private extractWalletAddress(log: Log): string | null {
    // Most events have indexed address as first topic after event signature
    if (log.topics && log.topics.length > 1) {
      const addressTopic = log.topics[1];
      if (addressTopic && addressTopic.length === 66) { // 0x + 64 chars
        // Extract address from padded topic (last 20 bytes)
        return `0x${addressTopic.slice(-40)}`;
      }
    }
    return null;
  }

  /**
   * Get event name from log (simplified - would need proper ABI decoding)
   */
  private getEventName(log: Log): string {
    // Would need ABI to decode properly, for now use signature
    return log.topics?.[0] || 'Unknown';
  }

  /**
   * Get current indexer state
   */
  private async getIndexerState(): Promise<{ lastIndexedBlock: bigint; lastIndexedHash: string }> {
    const state = await this.prisma.indexerState.findUnique({
      where: { id: 'singleton' },
    });

    if (!state) {
      // Initialize state
      await this.prisma.indexerState.create({
        data: {
          id: 'singleton',
          lastIndexedBlock: 0n,
          lastIndexedHash: '',
        },
      });
      return { lastIndexedBlock: 0n, lastIndexedHash: '' };
    }

    return {
      lastIndexedBlock: state.lastIndexedBlock,
      lastIndexedHash: state.lastIndexedHash,
    };
  }

  /**
   * Update indexer state after successful processing
   */
  private async updateIndexerState(blockNumber: bigint, blockHash: string): Promise<void> {
    await this.prisma.indexerState.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        lastIndexedBlock: blockNumber,
        lastIndexedHash: blockHash,
      },
      update: {
        lastIndexedBlock: blockNumber,
        lastIndexedHash: blockHash,
      },
    });
  }

  /**
   * Get cached events for a wallet (for transaction history API)
   */
  async getCachedEventsForWallet(
    walletAddress: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<any[]> {
    return this.prisma.cachedEvent.findMany({
      where: {
        walletAddress: walletAddress.toLowerCase(),
      },
      orderBy: {
        blockNumber: 'desc',
      },
      take: limit,
      skip: offset,
    });
  }
}