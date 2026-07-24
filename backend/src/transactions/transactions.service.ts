import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsQuery, TransactionsResponse, IndexedEventDto } from '@bfn/shared';

/**
 * Transactions service provides paginated transaction history
 * from cached blockchain events (Req 12.3, 12.4).
 */
@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get transaction history for a wallet address with cursor-based pagination.
   *
   * Returns cached events scoped to the requesting user's wallet address,
   * ordered by descending block number, properly paginated with at most
   * 100 events per response (Req 12.3).
   *
   * @param walletAddress User's wallet address for scoping
   * @param query Cursor and limit parameters
   * @returns Paginated transaction history with next cursor
   */
  async getTransactionHistory(
    walletAddress: string,
    query: TransactionsQuery,
  ): Promise<TransactionsResponse> {
    const { cursor, limit = 100 } = query;
    
    // Build where clause for wallet scoping and optional cursor
    const whereClause: any = {
      walletAddress: walletAddress.toLowerCase(), // Normalize address case
    };

    // If cursor is provided, only get events with blockNumber < cursor (for descending pagination)
    if (cursor) {
      whereClause.blockNumber = {
        lt: BigInt(cursor),
      };
    }

    // Query cached events scoped to the user's wallet address
    // Fetch limit + 1 to determine if there are more pages (Req 12.3, 12.4)
    const events = await this.prisma.cachedEvent.findMany({
      where: whereClause,
      orderBy: {
        blockNumber: 'desc', // Descending block number (most recent first)
      },
      take: limit + 1, // Fetch one extra to detect more pages
      select: {
        contractAddress: true,
        eventName: true,
        walletAddress: true,
        transactionHash: true,
        blockNumber: true,
        blockHash: true,
        logIndex: true,
        payload: true,
      },
    });

    // Determine if there are more pages and slice the results
    const hasNextPage = events.length > limit;
    const pageEvents = hasNextPage ? events.slice(0, limit) : events;

    // Convert to DTO format (block numbers as decimal strings)
    const eventDtos: IndexedEventDto[] = pageEvents.map(event => ({
      contractAddress: event.contractAddress as `0x${string}`,
      eventName: event.eventName,
      walletAddress: event.walletAddress as `0x${string}` | null,
      transactionHash: event.transactionHash as `0x${string}`,
      blockNumber: event.blockNumber.toString(),
      blockHash: event.blockHash as `0x${string}`,
      logIndex: event.logIndex,
      payload: event.payload as Record<string, unknown>,
    }));

    // Determine next cursor - only if there are more pages
    const nextCursor = hasNextPage && pageEvents.length > 0 
      ? pageEvents[pageEvents.length - 1]!.blockNumber.toString() 
      : null;

    return {
      events: eventDtos,
      nextCursor,
    };
  }
}